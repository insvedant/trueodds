const router = require('express').Router();
const User = require('../models/User');
const { constructWebhookEvent, stripe } = require('../services/stripeService');
const { syncRoles } = require('../services/discordService');
const { logActivity } = require('../services/logActivity');
const { sendSubscriptionLifecycleEmail } = require('../services/emailService');

const REFERRAL_THRESHOLD = 50;

function getInvoicePeriodEnd(invoice) {
    const lineEnd = invoice?.lines?.data?.[0]?.period?.end;
    return lineEnd ? new Date(lineEnd * 1000) : null;
}

router.post('/', async (req, res) => {
    const sig = req.headers['stripe-signature'];

    let event;

    try {
        event = constructWebhookEvent(req.body, sig);
    } catch (err) {
        return res.status(400).send(`Webhook Error: ${err.message}`);
    }

    try {
        switch (event.type) {
            case 'customer.subscription.trial_will_end': {
                const sub = event.data.object;
                const user = await User.findOne({ stripeCustomerId: sub.customer });

                if (user) {
                    console.log(`[Stripe] Trial ending soon for ${user.email}`);
                }

                break;
            }

            // -------------------------------------------------------------
            // PAYMENT SUCCEEDED
            // -------------------------------------------------------------
            case 'invoice.payment_succeeded': {
                const invoice = event.data.object;

                const user = await User.findOne({
                    stripeCustomerId: invoice.customer,
                });

                if (!user) {
                    console.warn(`[Stripe] Payment received for unknown customer ${invoice.customer}`);
                    break;
                }

                const amount = Number(invoice.amount_paid || 0) / 100;

                // Stripe sends a zero-dollar invoice when a subscription is
                // created with a trial. That is not revenue. Keep the event
                // visible in Stripe but do not create a payment record for $0.
                if (amount <= 0) {
                    console.log(`[Stripe] Ignoring zero-dollar invoice ${invoice.id}`);
                    break;
                }

                // Stripe can retry webhook deliveries. Never add the same
                // invoice to totalPaid/payments more than once.
                const alreadyRecorded = (user.payments || []).some(
                    p => p.stripeInvoiceId === invoice.id
                );

                if (alreadyRecorded) {
                    console.log(`[Stripe] Invoice ${invoice.id} already recorded for ${user.email}`);
                    break;
                }

                const previousStatus = user.subscriptionStatus;
                const previousPayments = user.payments?.length || 0;
                const trialEnd = user.trialEndsAt ? new Date(user.trialEndsAt) : null;
                const paymentDate = invoice.created
                    ? new Date(invoice.created * 1000)
                    : new Date();

                // A trial conversion is the first real paid invoice after the
                // recorded trial end. This works even if
                // customer.subscription.updated arrived first and already
                // changed subscriptionStatus to active.
                const convertedFromTrial =
                    !!trialEnd &&
                    paymentDate >= trialEnd &&
                    previousPayments === 0;

                const periodEnd = getInvoicePeriodEnd(invoice);

                if (invoice.subscription) {
                    user.stripeSubscriptionId = invoice.subscription;
                }

                user.subscriptionStatus = 'active';

                if (periodEnd) {
                    user.subscriptionExpiry = periodEnd;
                } else if (invoice.subscription) {
                    try {
                        const sub = await stripe.subscriptions.retrieve(invoice.subscription);
                        if (sub.current_period_end) {
                            user.subscriptionExpiry = new Date(sub.current_period_end * 1000);
                        }
                    } catch (e) {
                        console.warn('[Stripe] Could not retrieve subscription period:', e.message);
                    }
                }

                user.totalPaid = (user.totalPaid || 0) + amount;

                user.payments.push({
                    amount,
                    plan: user.plan,
                    stripeInvoiceId: invoice.id,
                    status: 'completed',
                    date: paymentDate,
                });

                await user.save({ validateBeforeSave: false });

                // Actual money received.
                await logActivity({
                    type: 'payment_succeeded',
                    user,
                    message: `Payment of $${amount.toFixed(2)} for ${user.plan} plan`,
                    meta: {
                        amount,
                        currency: invoice.currency || 'usd',
                        plan: user.plan,
                        invoiceId: invoice.id,
                        stripeSubscriptionId: invoice.subscription || user.stripeSubscriptionId || null,
                        billingReason: invoice.billing_reason || null,
                    },
                });

                // Trial -> Paid lifecycle event. Include the actual amount
                // so the admin dashboard can show who converted and what
                // Stripe charged.
                if (convertedFromTrial) {
                    console.log(`[Stripe] Trial converted to paid: ${user.email}`);

                    await logActivity({
                        type: 'subscription_activated',
                        user,
                        message: `${user.name}'s trial converted to a paid ${user.plan} subscription — $${amount.toFixed(2)} charged`,
                        meta: {
                            plan: user.plan,
                            amount,
                            currency: invoice.currency || 'usd',
                            invoiceId: invoice.id,
                            stripeSubscriptionId: invoice.subscription || user.stripeSubscriptionId || null,
                            previousStatus,
                            newStatus: 'active',
                            trialEndedAt: user.trialEndsAt || null,
                            subscriptionExpiry: user.subscriptionExpiry || null,
                        },
                    });

                    sendSubscriptionLifecycleEmail(
                        'trial_converted',
                        {
                            name: user.name,
                            email: user.email,
                            plan: user.plan,
                            amount,
                        }
                    ).catch(err =>
                        console.warn('[Email] Trial-converted alert failed:', err.message)
                    );
                }

                if (user.discordId) {
                    syncRoles(
                        user.discordId,
                        user.plan,
                        'active'
                    ).catch(e =>
                        console.warn('[Discord] role sync failed after payment:', e.message)
                    );
                }

                // Referral reward.
                const prevTotalPaid = (user.totalPaid || 0) - amount;

                if (
                    user.referredBy &&
                    prevTotalPaid < REFERRAL_THRESHOLD &&
                    user.totalPaid >= REFERRAL_THRESHOLD
                ) {
                    const referrer = await User.findById(user.referredBy);

                    if (referrer) {
                        referrer.referralRewards =
                            (referrer.referralRewards || 0) + 1;

                        referrer.referralCount =
                            (referrer.referralCount || 0) + 1;

                        const baseDate =
                            referrer.subscriptionExpiry &&
                            referrer.subscriptionExpiry > new Date()
                                ? referrer.subscriptionExpiry
                                : new Date();

                        referrer.subscriptionExpiry = new Date(
                            baseDate.getTime() + 30 * 24 * 60 * 60 * 1000
                        );

                        await referrer.save({
                            validateBeforeSave: false
                        });
                    }
                }

                break;
            }

            // -------------------------------------------------------------
            // PAYMENT FAILED
            // -------------------------------------------------------------
            case 'invoice.payment_failed': {
                const invoice = event.data.object;

                const user = await User.findOne({
                    stripeCustomerId: invoice.customer
                });

                if (user) {
                    user.subscriptionStatus = 'past_due';

                    await user.save({
                        validateBeforeSave: false
                    });

                    await logActivity({
                        type: 'payment_failed',
                        user,
                        status: 'failed',
                        message:
                            `Payment failed for ${user.plan} plan — subscription now past due`,
                        meta: {
                            plan: user.plan,
                            invoiceId: invoice.id,
                            amount: Number(invoice.amount_due || 0) / 100,
                        }
                    });

                    sendSubscriptionLifecycleEmail(
                        'payment_failed',
                        {
                            name: user.name,
                            email: user.email,
                            plan: user.plan
                        }
                    ).catch(err =>
                        console.warn(
                            '[Email] Payment-failed alert failed:',
                            err.message
                        )
                    );
                }

                break;
            }

            // -------------------------------------------------------------
            // SUBSCRIPTION CANCELLED
            // -------------------------------------------------------------
            case 'customer.subscription.deleted': {
                const sub = event.data.object;

                const user = await User.findOne({
                    stripeCustomerId: sub.customer
                });

                if (user) {
                    const cancelledPlan = user.plan;

                    user.subscriptionStatus = 'cancelled';
                    user.plan = 'free';

                    await user.save({
                        validateBeforeSave: false
                    });

                    await logActivity({
                        type: 'subscription_cancelled',
                        user,
                        message:
                            `Subscription cancelled for ${user.email}`,
                        meta: {
                            plan: cancelledPlan,
                            stripeSubscriptionId: sub.id,
                        }
                    });

                    sendSubscriptionLifecycleEmail(
                        'subscription_cancelled',
                        {
                            name: user.name,
                            email: user.email,
                            plan: cancelledPlan
                        }
                    ).catch(err =>
                        console.warn(
                            '[Email] Cancellation alert failed:',
                            err.message
                        )
                    );

                    if (user.discordId) {
                        syncRoles(
                            user.discordId,
                            'free',
                            'cancelled'
                        ).catch(e =>
                            console.warn(
                                '[Discord] role removal failed after cancel:',
                                e.message
                            )
                        );
                    }
                }

                break;
            }

            // -------------------------------------------------------------
            // SUBSCRIPTION UPDATED
            // -------------------------------------------------------------
            case 'customer.subscription.updated': {
                const sub = event.data.object;

                const user = await User.findOne({
                    stripeSubscriptionId: sub.id
                });

                if (user) {
                    if (sub.status === 'active') {
                        user.subscriptionStatus = 'active';
                    } else if (sub.status === 'trialing') {
                        user.subscriptionStatus = 'trial';
                    } else if (sub.status === 'past_due') {
                        user.subscriptionStatus = 'past_due';
                    } else if (sub.status === 'unpaid') {
                        user.subscriptionStatus = 'past_due';
                    }

                    if (sub.trial_end) {
                        user.trialEndsAt = new Date(sub.trial_end * 1000);
                    }

                    if (sub.current_period_end) {
                        user.subscriptionExpiry = new Date(
                            sub.current_period_end * 1000
                        );
                    }

                    await user.save({
                        validateBeforeSave: false
                    });

                    // Trial -> Paid activity is deliberately created from
                    // invoice.payment_succeeded because that event contains
                    // the actual amount charged.
                    if (user.discordId) {
                        syncRoles(
                            user.discordId,
                            user.plan,
                            user.subscriptionStatus
                        ).catch(e =>
                            console.warn(
                                '[Discord] role sync failed on sub update:',
                                e.message
                            )
                        );
                    }
                }

                break;
            }

            default:
                console.log(`Unhandled webhook event: ${event.type}`);
        }
    } catch (err) {
        console.error('Webhook handler error:', err);
        return res.status(500).json({
            error: 'Webhook processing failed.'
        });
    }

    res.json({
        received: true
    });
});

module.exports = router;
