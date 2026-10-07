const router = require('express').Router();

const User = require('../models/User');
const { constructWebhookEvent } = require('../services/stripeService');
const { syncRoles } = require('../services/discordService');
const { logActivity } = require('../services/logActivity');
const { sendSubscriptionLifecycleEmail } = require('../services/emailService');

const REFERRAL_THRESHOLD = 50;

router.post(
    '/stripe',
    require('express').raw({ type: 'application/json' }),
    async (req, res) => {
        const sig = req.headers['stripe-signature'];

        let event;

        try {
            event = constructWebhookEvent(req.body, sig);
        } catch (err) {
            return res.status(400).send(`Webhook Error: ${err.message}`);
        }

        try {
            switch (event.type) {

                // ---------------------------------------------------------
                // TRIAL WILL END
                // ---------------------------------------------------------
                case 'customer.subscription.trial_will_end': {
                    const sub = event.data.object;

                    const user = await User.findOne({
                        stripeCustomerId: sub.customer
                    });

                    if (user) {
                        console.log(
                            `Trial ending soon for ${user.email}`
                        );
                    }

                    break;
                }

                // ---------------------------------------------------------
                // PAYMENT SUCCEEDED
                // ---------------------------------------------------------
                case 'invoice.payment_succeeded': {
                    const invoice = event.data.object;

                    // Ignore the initial subscription invoice.
                    // Trial conversion/payment should be handled by
                    // customer.subscription.updated.
                    if (invoice.billing_reason === 'subscription_create') {
                        break;
                    }

                    const user = await User.findOne({
                        stripeCustomerId: invoice.customer
                    });

                    if (!user) {
                        break;
                    }

                    const amount = invoice.amount_paid / 100;
                    const prevTotalPaid = user.totalPaid || 0;

                    user.subscriptionStatus = 'active';

                    /*
                     * Use Stripe's actual subscription period when available.
                     * This is more reliable than always adding 30 days.
                     */
                    if (
                        invoice.subscription_details &&
                        invoice.subscription_details.current_period_end
                    ) {
                        user.subscriptionExpiry = new Date(
                            invoice.subscription_details.current_period_end * 1000
                        );
                    }

                    user.totalPaid = prevTotalPaid + amount;

                    user.payments.push({
                        amount,
                        plan: user.plan,
                        stripeInvoiceId: invoice.id,
                        status: 'completed',
                    });

                    await user.save({
                        validateBeforeSave: false
                    });

                    // -----------------------------------------------------
                    // PAYMENT LOG
                    // -----------------------------------------------------
                    await logActivity({
                        type: 'payment_succeeded',
                        user,
                        message: `Payment of $${amount} for ${user.plan} plan`,
                        meta: {
                            amount,
                            plan: user.plan,
                            invoiceId: invoice.id
                        }
                    });

                    /*
                     * IMPORTANT:
                     *
                     * Do NOT detect trial conversion here using:
                     *
                     * user.subscriptionStatus === 'trial'
                     *
                     * because customer.subscription.updated may already
                     * have changed the status to active before this webhook.
                     *
                     * The actual Trial -> Paid log is now created inside
                     * customer.subscription.updated.
                     */

                    if (user.discordId) {
                        syncRoles(
                            user.discordId,
                            user.plan,
                            'active'
                        ).catch(e =>
                            console.warn(
                                '[Discord] role sync failed after payment:',
                                e.message
                            )
                        );
                    }

                    // -----------------------------------------------------
                    // REFERRAL REWARD
                    // -----------------------------------------------------
                    if (
                        user.referredBy &&
                        prevTotalPaid < REFERRAL_THRESHOLD &&
                        user.totalPaid >= REFERRAL_THRESHOLD
                    ) {
                        const referrer = await User.findById(
                            user.referredBy
                        );

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
                                baseDate.getTime() +
                                30 * 24 * 60 * 60 * 1000
                            );

                            await referrer.save({
                                validateBeforeSave: false
                            });
                        }
                    }

                    break;
                }

                // ---------------------------------------------------------
                // PAYMENT FAILED
                // ---------------------------------------------------------
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
                                invoiceId: invoice.id
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

                // ---------------------------------------------------------
                // SUBSCRIPTION CANCELLED
                // ---------------------------------------------------------
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
                                `Subscription cancelled for ${user.email}`
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

                // ---------------------------------------------------------
                // SUBSCRIPTION UPDATED
                // ---------------------------------------------------------
                case 'customer.subscription.updated': {
                    const sub = event.data.object;

                    const user = await User.findOne({
                        stripeSubscriptionId: sub.id
                    });

                    if (user) {

                        /*
                         * IMPORTANT:
                         *
                         * Capture the user's OLD subscription status BEFORE
                         * changing it.
                         *
                         * This allows us to detect:
                         *
                         * trial -> active
                         *
                         * reliably, regardless of Stripe webhook order.
                         */
                        const previousStatus =
                            user.subscriptionStatus;

                        const convertedFromTrial =
                            previousStatus === 'trial' &&
                            sub.status === 'active';

                        // -------------------------------------------------
                        // UPDATE SUBSCRIPTION STATUS
                        // -------------------------------------------------

                        if (sub.status === 'active') {
                            user.subscriptionStatus = 'active';
                        } else if (sub.status === 'trialing') {
                            user.subscriptionStatus = 'trial';
                        } else if (sub.status === 'past_due') {
                            user.subscriptionStatus = 'past_due';
                        } else if (sub.status === 'unpaid') {
                            user.subscriptionStatus = 'past_due';
                        }

                        // -------------------------------------------------
                        // UPDATE TRIAL END
                        // -------------------------------------------------

                        if (sub.trial_end) {
                            user.trialEndsAt = new Date(
                                sub.trial_end * 1000
                            );
                        }

                        // -------------------------------------------------
                        // UPDATE SUBSCRIPTION EXPIRY
                        // -------------------------------------------------

                        if (sub.current_period_end) {
                            user.subscriptionExpiry = new Date(
                                sub.current_period_end * 1000
                            );
                        }

                        await user.save({
                            validateBeforeSave: false
                        });

                        // -------------------------------------------------
                        // TRIAL -> PAID LOG
                        // -------------------------------------------------

                        if (convertedFromTrial) {

                            console.log(
                                `[Stripe] Trial converted to paid: ${user.email}`
                            );

                            await logActivity({
                                type: 'subscription_activated',
                                user,
                                message:
                                    `${user.name}'s trial converted to a paid ${user.plan} subscription`,
                                meta: {
                                    plan: user.plan,
                                    stripeSubscriptionId: sub.id,
                                    previousStatus,
                                    newStatus: sub.status,
                                    trialEndedAt: sub.trial_end
                                        ? new Date(
                                            sub.trial_end * 1000
                                        )
                                        : null,
                                    subscriptionExpiry:
                                        user.subscriptionExpiry
                                }
                            });

                            // -------------------------------------------------
                            // TRIAL CONVERSION EMAIL
                            // -------------------------------------------------

                            sendSubscriptionLifecycleEmail(
                                'trial_converted',
                                {
                                    name: user.name,
                                    email: user.email,
                                    plan: user.plan
                                }
                            ).catch(err =>
                                console.warn(
                                    '[Email] Trial-converted alert failed:',
                                    err.message
                                )
                            );
                        }

                        // -------------------------------------------------
                        // DISCORD ROLE SYNC
                        // -------------------------------------------------

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

                // ---------------------------------------------------------
                // DEFAULT
                // ---------------------------------------------------------
                default:
                    console.log(
                        `Unhandled webhook event: ${event.type}`
                    );
            }
        } catch (err) {
            console.error(
                'Webhook handler error:',
                err
            );

            return res.status(500).json({
                error: 'Webhook processing failed.'
            });
        }

        res.json({
            received: true
        });
    }
);

module.exports = router;
