/**
 * stripeSync.js — reconcile Stripe into MongoDB.
 *
 * Why this exists: Stripe is the system of record for who is paying and who
 * has cancelled — and a subscription can be cancelled outside TrueOdds (in the
 * Stripe dashboard, or by a customer through Stripe), without TrueOdds being told
 * unless the webhook delivers. The webhook is the fast path, but a missed or rejected
 * delivery would otherwise leave the admin panel permanently wrong. This sync
 * is the safety net: it re-reads Stripe and applies anything we don't have.
 *
 * It uses the same ledger functions as the webhook, is safe to run repeatedly
 * and concurrently, and never double-counts a payment (invoice ids are the
 * idempotency key, enforced atomically).
 *
 * options.sinceDays  limit the invoice scan to recent invoices (scheduled
 *                    runs). Omit for a full historical backfill (manual run).
 */
const User = require('../models/User');
const { stripe } = require('./stripeService');
const ledger = require('./stripeLedger');

const DAY = 24 * 60 * 60 * 1000;
// Only email/notify for things that just happened. A backfill of old history
// must never spam the owner with stale "trial converted" alerts.
const FRESH_MS = 2 * DAY;

async function listAll(resource, params) {
    const items = [];
    let startingAfter;
    while (true) {
        const page = await stripe[resource].list({ ...params, limit: 100, ...(startingAfter ? { starting_after: startingAfter } : {}) });
        items.push(...page.data);
        if (!page.has_more || page.data.length === 0) break;
        startingAfter = page.data[page.data.length - 1].id;
    }
    return items;
}

async function syncStripeToMongo({ sinceDays = null } = {}) {
    const users = await User.find({ stripeCustomerId: { $exists: true, $ne: null } }).select('_id stripeCustomerId');
    const userIdByCustomer = new Map(users.map(u => [String(u.stripeCustomerId), u._id]));

    const summary = {
        usersScanned: users.length,
        invoicesSeen: 0,
        usersMatched: 0,
        paymentsAdded: 0,
        conversionLogsAdded: 0,
        subscriptionsSeen: 0,
        subscriptionsUpdated: 0,
        cancellationsLogged: 0,
        totalsCorrected: 0,
        mode: sinceDays ? `last ${sinceDays} days` : 'full history',
    };

    // 1. Payments — every paid invoice for a known customer.
    const invoiceParams = { status: 'paid' };
    if (sinceDays) invoiceParams.created = { gte: Math.floor((Date.now() - sinceDays * DAY) / 1000) };
    const invoices = (await listAll('invoices', invoiceParams)).sort((a, b) => (a.created || 0) - (b.created || 0));

    for (const invoice of invoices) {
        if (!(Number(invoice.amount_paid || 0) > 0)) continue;
        summary.invoicesSeen++;

        const userId = userIdByCustomer.get(String(invoice.customer?.id || invoice.customer));
        if (!userId) continue;
        summary.usersMatched++;

        const user = await User.findById(userId);
        if (!user) continue;

        const fresh = Date.now() - (invoice.created || 0) * 1000 < FRESH_MS;
        const result = await ledger.applyPaidInvoice(user, invoice, { updateState: false, notify: fresh });
        if (result.isNewPayment) summary.paymentsAdded++;
        if (result.conversionLogged) summary.conversionLogsAdded++;
    }

    // 2. Subscriptions — authoritative for status / plan / trial end / renewal /
    // scheduled cancellation. Ended ones go first so that a customer who
    // cancelled and later re-subscribed finishes on the NEW subscription.
    const subscriptions = await listAll('subscriptions', { status: 'all' });
    subscriptions.sort((a, b) => {
        const aEnded = ledger.ENDED_STATUSES.has(a.status) ? 0 : 1;
        const bEnded = ledger.ENDED_STATUSES.has(b.status) ? 0 : 1;
        return aEnded - bEnded || (a.created || 0) - (b.created || 0);
    });

    for (const sub of subscriptions) {
        const userId = userIdByCustomer.get(String(sub.customer?.id || sub.customer));
        if (!userId) continue;
        summary.subscriptionsSeen++;

        const user = await User.findById(userId);
        if (!user) continue;

        const endedAtMs = (sub.ended_at || sub.canceled_at || 0) * 1000;
        const justHappened = endedAtMs ? Date.now() - endedAtMs < FRESH_MS : true;

        const result = await ledger.applySubscriptionState(user, sub, { notify: justHappened });
        if (result.changed) summary.subscriptionsUpdated++;
        if (result.cancellationLogged) summary.cancellationsLogged++;

        const current = result.user || user;
        await ledger.ensureTrialStartedLogged(current, sub);
    }

    // 3. Keep each user's running total equal to the sum of their ledger, so
    // the aggregate shown in the Users tab can never drift from the invoices.
    for (const userId of userIdByCustomer.values()) {
        const user = await User.findById(userId).select('payments totalPaid');
        if (!user) continue;
        const ledgerTotal = (user.payments || []).reduce((sum, p) => sum + (Number(p.amount) || 0), 0);
        if (Math.abs((user.totalPaid || 0) - ledgerTotal) > 0.005) {
            await User.updateOne({ _id: userId }, { $set: { totalPaid: Math.round(ledgerTotal * 100) / 100 } });
            summary.totalsCorrected++;
        }
    }

    return summary;
}

module.exports = { syncStripeToMongo };
