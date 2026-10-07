const User = require('../models/User');
const ActivityLog = require('../models/ActivityLog');
const { stripe } = require('./stripeService');

async function listAllPaidInvoices() {
    const invoices = [];
    let startingAfter;

    while (true) {
        const params = {
            status: 'paid',
            limit: 100,
        };

        if (startingAfter) params.starting_after = startingAfter;

        const page = await stripe.invoices.list(params);
        invoices.push(...page.data);

        if (!page.has_more || page.data.length === 0) break;
        startingAfter = page.data[page.data.length - 1].id;
    }

    return invoices.sort((a, b) => (a.created || 0) - (b.created || 0));
}

async function listAllSubscriptions() {
    const subscriptions = [];
    let startingAfter;

    while (true) {
        const params = {
            status: 'all',
            limit: 100,
        };

        if (startingAfter) params.starting_after = startingAfter;

        const page = await stripe.subscriptions.list(params);
        subscriptions.push(...page.data);

        if (!page.has_more || page.data.length === 0) break;
        startingAfter = page.data[page.data.length - 1].id;
    }

    return subscriptions;
}

function mapSubscriptionStatus(status) {
    if (status === 'active') return 'active';
    if (status === 'trialing') return 'trial';
    if (status === 'past_due' || status === 'unpaid') return 'past_due';
    if (status === 'canceled' || status === 'incomplete_expired') return 'cancelled';
    return null;
}

function basePlanFromMetadata(subscription) {
    const raw = subscription?.metadata?.plan || '';
    return raw.replace('_yearly', '') || null;
}

async function syncStripeToMongo() {
    const users = await User.find({
        stripeCustomerId: { $exists: true, $ne: null }
    });

    const byCustomer = new Map(
        users.map(user => [String(user.stripeCustomerId), user])
    );

    let invoicesSeen = 0;
    let paymentsAdded = 0;
    let paymentLogsAdded = 0;
    let conversionLogsAdded = 0;
    let subscriptionsUpdated = 0;
    let usersMatched = 0;

    // 1. Reconcile every paid Stripe invoice into User.payments/totalPaid
    // and the admin activity log.
    const invoices = await listAllPaidInvoices();

    for (const invoice of invoices) {
        const amount = Number(invoice.amount_paid || 0) / 100;
        if (amount <= 0) continue;

        invoicesSeen++;

        const user = byCustomer.get(String(invoice.customer));
        if (!user) continue;

        usersMatched++;

        const existingPayment = (user.payments || []).find(
            p => p.stripeInvoiceId === invoice.id
        );
        const wasFirstPayment = (user.payments || []).length === 0;

        const paymentDate = invoice.created
            ? new Date(invoice.created * 1000)
            : new Date();

        if (!existingPayment) {
            user.payments.push({
                amount,
                plan: user.plan,
                stripeInvoiceId: invoice.id,
                status: 'completed',
                date: paymentDate,
            });

            user.totalPaid = (user.totalPaid || 0) + amount;
            user.subscriptionStatus = 'active';

            if (invoice.subscription) {
                user.stripeSubscriptionId = invoice.subscription;
            }

            const periodEnd = invoice?.lines?.data?.[0]?.period?.end;
            if (periodEnd) {
                user.subscriptionExpiry = new Date(periodEnd * 1000);
            }

            await user.save({ validateBeforeSave: false });
            paymentsAdded++;
        } else if (existingPayment.amount !== amount || existingPayment.status !== 'completed') {
            existingPayment.amount = amount;
            existingPayment.status = 'completed';
            await user.save({ validateBeforeSave: false });
        }

        if (!await ActivityLog.exists({
            type: 'payment_succeeded',
            'meta.invoiceId': invoice.id,
        })) {
            await ActivityLog.create({
                type: 'payment_succeeded',
                category: 'subscription',
                status: 'success',
                message: `Payment of $${amount.toFixed(2)} for ${user.plan} plan`,
                userId: user._id,
                email: user.email,
                name: user.name,
                role: user.role || 'user',
                meta: {
                    amount,
                    currency: invoice.currency || 'usd',
                    plan: user.plan,
                    invoiceId: invoice.id,
                    stripeSubscriptionId: invoice.subscription || user.stripeSubscriptionId || null,
                    billingReason: invoice.billing_reason || null,
                },
                createdAt: paymentDate,
            });
            paymentLogsAdded++;
        }

        const trialEnd = user.trialEndsAt ? new Date(user.trialEndsAt) : null;
        const isTrialConversion =
            !!trialEnd &&
            paymentDate >= trialEnd &&
            wasFirstPayment;

        if (
            isTrialConversion &&
            !await ActivityLog.exists({
                type: 'subscription_activated',
                'meta.invoiceId': invoice.id,
            })
        ) {
            await ActivityLog.create({
                type: 'subscription_activated',
                category: 'subscription',
                status: 'success',
                message: `${user.name}'s trial converted to a paid ${user.plan} subscription — $${amount.toFixed(2)} charged`,
                userId: user._id,
                email: user.email,
                name: user.name,
                role: user.role || 'user',
                meta: {
                    plan: user.plan,
                    amount,
                    currency: invoice.currency || 'usd',
                    invoiceId: invoice.id,
                    stripeSubscriptionId: invoice.subscription || user.stripeSubscriptionId || null,
                    previousStatus: 'trial',
                    newStatus: 'active',
                    trialEndedAt: user.trialEndsAt || null,
                    subscriptionExpiry: user.subscriptionExpiry || null,
                },
                createdAt: paymentDate,
            });
            conversionLogsAdded++;
        }
    }

    // Normalize each user's aggregate total from the payment ledger so
    // the admin dashboard cannot drift from the actual recorded invoices.
    for (const user of users) {
        const ledgerTotal = (user.payments || []).reduce(
            (sum, payment) => sum + (Number(payment.amount) || 0),
            0
        );
        if (Math.abs((user.totalPaid || 0) - ledgerTotal) > 0.000001) {
            user.totalPaid = ledgerTotal;
            await user.save({ validateBeforeSave: false });
        }
    }

    // 2. Reconcile subscription status/trial/expiry for every Stripe
    // subscription belonging to a known TrueOdds customer.
    const subscriptions = await listAllSubscriptions();

    for (const sub of subscriptions) {
        const user = byCustomer.get(String(sub.customer));
        if (!user) continue;

        let changed = false;

        if (user.stripeSubscriptionId !== sub.id) {
            // Prefer the current non-cancelled subscription.
            if (!['canceled', 'incomplete_expired'].includes(sub.status)) {
                user.stripeSubscriptionId = sub.id;
                changed = true;
            }
        }

        const mappedStatus = mapSubscriptionStatus(sub.status);

        // Never let an old canceled subscription overwrite a newer active
        // subscription for the same customer.
        if (
            mappedStatus === 'cancelled' &&
            user.stripeSubscriptionId !== sub.id
        ) {
            continue;
        }

        if (mappedStatus && user.subscriptionStatus !== mappedStatus) {
            user.subscriptionStatus = mappedStatus;
            changed = true;
        }

        if (sub.trial_end) {
            const trialEndsAt = new Date(sub.trial_end * 1000);
            if (!user.trialEndsAt || user.trialEndsAt.getTime() !== trialEndsAt.getTime()) {
                user.trialEndsAt = trialEndsAt;
                changed = true;
            }
        }

        if (sub.current_period_end) {
            const expiry = new Date(sub.current_period_end * 1000);
            if (!user.subscriptionExpiry || user.subscriptionExpiry.getTime() !== expiry.getTime()) {
                user.subscriptionExpiry = expiry;
                changed = true;
            }
        }

        const plan = basePlanFromMetadata(sub);
        if (plan && ['basic', 'gold', 'platinum'].includes(plan) && user.plan !== plan && mappedStatus !== 'cancelled') {
            user.plan = plan;
            changed = true;
        }

        if (changed) {
            await user.save({ validateBeforeSave: false });
            subscriptionsUpdated++;
        }

        if (
            sub.status === 'trialing' &&
            user.trialEndsAt &&
            !await ActivityLog.exists({
                type: 'trial_started',
                'meta.stripeSubscriptionId': sub.id,
            })
        ) {
            await ActivityLog.create({
                type: 'trial_started',
                category: 'subscription',
                status: 'success',
                message: `${user.name} started a ${user.plan} trial`,
                userId: user._id,
                email: user.email,
                name: user.name,
                role: user.role || 'user',
                meta: {
                    plan: user.plan,
                    stripeSubscriptionId: sub.id,
                    trialEndsAt: user.trialEndsAt,
                },
                createdAt: sub.start_date
                    ? new Date(sub.start_date * 1000)
                    : new Date(),
            });
        }
    }

    return {
        invoicesSeen,
        usersMatched,
        paymentsAdded,
        paymentLogsAdded,
        conversionLogsAdded,
        subscriptionsUpdated,
        usersScanned: users.length,
    };
}

module.exports = { syncStripeToMongo };
