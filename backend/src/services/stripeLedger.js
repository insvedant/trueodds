/**
 * stripeLedger.js — the single place where Stripe state is applied to MongoDB.
 *
 * Both the live webhook (routes/webhook.js) and the reconciliation sync
 * (services/stripeSync.js) call these functions, so the two paths can never
 * disagree about what "paid", "converted" or "cancelled" mean.
 *
 * Design rules:
 *  - Idempotent. Stripe retries webhooks, sends invoice.paid *and*
 *    invoice.payment_succeeded for one payment, and the sync re-reads history.
 *    Every function here is safe to run any number of times for the same event.
 *  - Race-safe. Payments are recorded with one atomic update that only
 *    succeeds if the invoice id isn't already in the ledger, so concurrent
 *    webhook + sync runs cannot double-count revenue.
 *  - Stripe is the source of truth for subscription state (status, plan,
 *    trial end, renewal date). Payments are the source of truth for revenue.
 */
const User = require('../models/User');
const ActivityLog = require('../models/ActivityLog');
const {
    getInvoiceSubscriptionId,
    getInvoicePeriodEnd,
    getSubscriptionPeriodEnd,
    planFromSubscription,
    planFromPriceId,
} = require('./stripeService');

const REFERRAL_THRESHOLD = 50;
const HOUR = 60 * 60 * 1000;
const ENDED_STATUSES = new Set(['canceled', 'incomplete_expired']);

// ---------------------------------------------------------------------------
// helpers
// ---------------------------------------------------------------------------
function mapStripeStatus(status) {
    switch (status) {
        case 'active': return 'active';
        case 'trialing': return 'trial';
        case 'past_due':
        case 'unpaid': return 'past_due';
        case 'paused': return 'inactive';
        default: return null; // incomplete etc. — leave the current value alone
    }
}

function planFromInvoice(invoice) {
    const line = invoice?.lines?.data?.[0];
    const priceId = line?.price?.id || line?.pricing?.price_details?.price || null;
    return planFromPriceId(priceId);
}

function toDate(unixSeconds) {
    return unixSeconds ? new Date(unixSeconds * 1000) : null;
}

/**
 * Writes one subscription-category activity entry. Returns true only if THIS
 * call created it, false if it already existed (or the write failed), so
 * callers can send notification emails exactly once.
 *  - dedupeKey: unique per real-world event; enforced by a unique index.
 *  - legacy:    extra filter matching entries written by older code that had
 *               no dedupeKey, so upgrading doesn't re-log history.
 */
async function recordActivity({ type, user, message, status = 'success', meta = {}, createdAt, dedupeKey, legacy }) {
    try {
        if (legacy && await ActivityLog.exists({ type, ...legacy })) return false;
        await ActivityLog.create({
            type,
            category: 'subscription',
            status,
            message,
            userId: user._id,
            email: user.email,
            name: user.name,
            role: user.role || 'user',
            meta: dedupeKey ? { ...meta, dedupeKey } : meta,
            createdAt: createdAt || new Date(),
        });
        return true;
    }
    catch (err) {
        if (err && err.code === 11000) return false; // already logged
        console.warn(`[StripeLedger] activity log failed (${type}):`, err.message);
        return false;
    }
}

function notifyLifecycle(eventType, payload) {
    try {
        require('./emailService')
            .sendSubscriptionLifecycleEmail(eventType, payload)
            .catch(err => console.warn(`[Email] ${eventType} alert failed:`, err.message));
    }
    catch (err) {
        console.warn(`[Email] ${eventType} alert failed:`, err.message);
    }
}

function syncDiscordRoles(user, statusForRoles) {
    if (!user.discordId) return;
    try {
        require('./discordService')
            .syncRoles(user.discordId, user.plan, statusForRoles)
            .catch(e => console.warn('[Discord] role sync failed:', e.message));
    }
    catch (e) {
        console.warn('[Discord] role sync failed:', e.message);
    }
}

async function findUserByStripe({ subscriptionId, customerId }) {
    let user = null;
    if (subscriptionId) user = await User.findOne({ stripeSubscriptionId: subscriptionId });
    if (!user && customerId) user = await User.findOne({ stripeCustomerId: customerId });
    return user;
}

// ---------------------------------------------------------------------------
// payments
// ---------------------------------------------------------------------------
/**
 * Atomically appends a payment unless that invoice is already in the ledger.
 * Returns true if it was newly recorded.
 */
async function recordPaymentAtomic(userId, entry) {
    const res = await User.updateOne(
        { _id: userId, 'payments.stripeInvoiceId': { $ne: entry.stripeInvoiceId } },
        { $push: { payments: entry }, $inc: { totalPaid: entry.amount } }
    );
    return (res.modifiedCount ?? res.nModified ?? 0) === 1;
}

async function grantReferralReward(userId, amount) {
    const u = await User.findById(userId);
    if (!u || !u.referredBy) return;
    const prevTotal = (u.totalPaid || 0) - amount;
    if (!(prevTotal < REFERRAL_THRESHOLD && u.totalPaid >= REFERRAL_THRESHOLD)) return;
    const referrer = await User.findById(u.referredBy);
    if (!referrer) return;
    referrer.referralRewards = (referrer.referralRewards || 0) + 1;
    referrer.referralCount = (referrer.referralCount || 0) + 1;
    const base = referrer.subscriptionExpiry && referrer.subscriptionExpiry > new Date()
        ? referrer.subscriptionExpiry
        : new Date();
    referrer.subscriptionExpiry = new Date(base.getTime() + 30 * 24 * HOUR);
    await referrer.save({ validateBeforeSave: false });
}

/**
 * Records a paid Stripe invoice.
 *  updateState — also move the user to "active" and refresh renewal date
 *                (live webhook). The sync passes false and derives state from
 *                the subscription itself, so replaying old invoices can never
 *                flip a cancelled customer back to active.
 *  notify      — send owner emails / Discord role sync / referral reward.
 *                Only ever fires for a payment that is genuinely new.
 */
async function applyPaidInvoice(user, invoice, { updateState = false, notify = false } = {}) {
    const amount = Number(invoice.amount_paid || 0) / 100;
    // Stripe issues a $0 invoice when a trial subscription is created.
    // That is not revenue and must not enter the ledger.
    if (!(amount > 0)) return { outcome: 'ignored_zero_amount', user };

    const paymentDate = invoice.created ? new Date(invoice.created * 1000) : new Date();
    const subscriptionId = getInvoiceSubscriptionId(invoice);
    const periodEnd = getInvoicePeriodEnd(invoice);
    const plan = planFromInvoice(invoice) || user.plan;

    const isNewPayment = await recordPaymentAtomic(user._id, {
        amount,
        plan,
        stripeInvoiceId: invoice.id,
        status: 'completed',
        date: paymentDate,
    });

    // The atomic update bypassed the in-memory document; re-read before
    // making any further changes so we never overwrite the new ledger entry.
    const fresh = await User.findById(user._id);
    if (!fresh) return { outcome: 'user_missing', user };

    const ledger = [...(fresh.payments || [])]
        .filter(p => p.date)
        .sort((a, b) => new Date(a.date) - new Date(b.date));
    const isFirstPayment = ledger.length > 0 && ledger[0].stripeInvoiceId === invoice.id;
    const trialEnd = fresh.trialEndsAt ? new Date(fresh.trialEndsAt) : null;

    // Trial -> Paid: the first real payment, charged when the trial ended.
    // billing_reason 'subscription_cycle' on a first-ever payment means the
    // charge came from a trial rolling over; the date check covers older API
    // versions and backfilled invoices. One hour of slack absorbs clock skew
    // between trial_end and the invoice's created timestamp.
    const convertedFromTrial = isFirstPayment && (
        invoice.billing_reason === 'subscription_cycle' ||
        (!!trialEnd && paymentDate.getTime() >= trialEnd.getTime() - HOUR)
    );

    if (updateState) {
        const latest = ledger.length ? new Date(ledger[ledger.length - 1].date) : paymentDate;
        const isLatestPayment = paymentDate.getTime() >= latest.getTime();
        // A late retry of an old invoice must not resurrect a customer whose
        // subscription has since been ended.
        const resurrecting = fresh.subscriptionStatus === 'cancelled' && !fresh.stripeSubscriptionId;
        if (isLatestPayment && !resurrecting) {
            if (subscriptionId) fresh.stripeSubscriptionId = subscriptionId;
            fresh.subscriptionStatus = fresh.cancelAtPeriodEnd ? 'cancelled' : 'active';
            if (periodEnd) fresh.subscriptionExpiry = periodEnd;
            await fresh.save({ validateBeforeSave: false });
        }
    }

    const common = {
        amount,
        currency: invoice.currency || 'usd',
        plan,
        invoiceId: invoice.id,
        stripeSubscriptionId: subscriptionId || fresh.stripeSubscriptionId || null,
        billingReason: invoice.billing_reason || null,
    };

    await recordActivity({
        type: 'payment_succeeded',
        user: fresh,
        message: `Payment of $${amount.toFixed(2)} for ${plan} plan`,
        meta: common,
        createdAt: paymentDate,
        dedupeKey: `payment:${invoice.id}`,
        legacy: { 'meta.invoiceId': invoice.id },
    });

    let conversionLogged = false;
    if (convertedFromTrial) {
        conversionLogged = await recordActivity({
            type: 'subscription_activated',
            user: fresh,
            message: `${fresh.name}'s trial converted to a paid ${plan} subscription — $${amount.toFixed(2)} charged`,
            meta: {
                ...common,
                previousStatus: 'trial',
                newStatus: 'active',
                trialEndedAt: fresh.trialEndsAt || null,
                subscriptionExpiry: fresh.subscriptionExpiry || null,
            },
            createdAt: paymentDate,
            dedupeKey: `conversion:${invoice.id}`,
            legacy: { 'meta.invoiceId': invoice.id },
        });
    }

    if (notify) {
        if (conversionLogged) {
            notifyLifecycle('trial_converted', { name: fresh.name, email: fresh.email, plan, amount });
        }
        if (isNewPayment) {
            syncDiscordRoles(fresh, 'active');
            await grantReferralReward(fresh._id, amount).catch(e => console.warn('[Referral] reward failed:', e.message));
        }
    }

    return {
        outcome: isNewPayment ? 'recorded' : 'duplicate',
        isNewPayment,
        convertedFromTrial,
        conversionLogged,
        user: fresh,
    };
}

async function applyPaymentFailed(user, invoice, { notify = false } = {}) {
    const subscriptionId = getInvoiceSubscriptionId(invoice);
    if (user.stripeSubscriptionId && subscriptionId && user.stripeSubscriptionId !== subscriptionId) {
        return { outcome: 'other_subscription', user }; // an old subscription's invoice
    }
    if (['active', 'trial', 'past_due'].includes(user.subscriptionStatus)) {
        user.subscriptionStatus = 'past_due';
        await user.save({ validateBeforeSave: false });
    }
    const attempt = invoice.attempt_count || 1;
    const logged = await recordActivity({
        type: 'payment_failed',
        status: 'failed',
        user,
        message: `Payment failed for ${user.plan} plan — subscription now past due`,
        meta: {
            plan: user.plan,
            invoiceId: invoice.id,
            amount: Number(invoice.amount_due || 0) / 100,
            attempt,
        },
        dedupeKey: `failed:${invoice.id}:${attempt}`,
    });
    if (logged && notify) {
        notifyLifecycle('payment_failed', { name: user.name, email: user.email, plan: user.plan });
    }
    return { outcome: 'failed_recorded', logged, user };
}

// ---------------------------------------------------------------------------
// subscription lifecycle
// ---------------------------------------------------------------------------
async function logCancellation(user, sub, { plan, accessEndsAt, by }) {
    const cancelledAt = toDate(sub?.canceled_at) || new Date();
    const who = by === 'admin' ? ' by an admin' : '';
    const message = accessEndsAt && accessEndsAt > new Date()
        ? `${user.name} cancelled their ${plan || user.plan} subscription${who} — access ends ${accessEndsAt.toLocaleDateString('en-US')}`
        : `Subscription cancelled${who} for ${user.email}`;
    return recordActivity({
        type: 'subscription_cancelled',
        user,
        message,
        meta: {
            plan: plan || user.plan,
            stripeSubscriptionId: sub?.id || null,
            accessEndsAt: accessEndsAt || null,
            by: by || null,
        },
        createdAt: cancelledAt,
        // Without a subscription id there is nothing safe to dedupe on.
        dedupeKey: sub?.id ? `cancel:${sub.id}` : undefined,
        legacy: sub?.id ? { 'meta.stripeSubscriptionId': sub.id } : undefined,
    });
}

/**
 * The subscription has fully ended in Stripe: remove the plan, clear the
 * subscription link (so the customer can subscribe again), and log it once.
 */
async function applySubscriptionEnded(user, sub, { notify = false, by = null } = {}) {
    const pointsAtIt = user.stripeSubscriptionId === sub.id;
    // The old self-service cancel route cleared the subscription id but kept
    // the plan until Stripe confirmed the end — finish that transition here.
    const lingering = !user.stripeSubscriptionId && user.subscriptionStatus === 'cancelled' && user.plan !== 'free';
    const cancelledPlan = planFromSubscription(sub) || (user.plan !== 'free' ? user.plan : null);

    let changed = false;
    if (pointsAtIt || lingering) {
        user.subscriptionStatus = 'cancelled';
        user.plan = 'free';
        user.stripeSubscriptionId = null;
        user.cancelAtPeriodEnd = false;
        await user.save({ validateBeforeSave: false });
        changed = true;
    }

    const logged = await logCancellation(user, sub, { plan: cancelledPlan, by });

    if (notify && changed) syncDiscordRoles(user, 'cancelled');
    if (notify && logged) {
        notifyLifecycle('subscription_cancelled', { name: user.name, email: user.email, plan: cancelledPlan || user.plan });
    }
    return { outcome: changed ? 'ended' : (logged ? 'logged_only' : 'unchanged'), changed, cancellationLogged: logged, user };
}

/**
 * Apply a live (not yet ended) Stripe subscription to the user: status, plan,
 * trial end, renewal date, and scheduled-cancellation flag.
 */
async function applySubscriptionState(user, sub, { notify = false, by = null } = {}) {
    if (!sub) return { outcome: 'no_subscription', user };
    if (ENDED_STATUSES.has(sub.status)) return applySubscriptionEnded(user, sub, { notify, by });

    // The customer already has a different subscription on record — don't let
    // a stray event for another one overwrite it.
    if (user.stripeSubscriptionId && user.stripeSubscriptionId !== sub.id) {
        return { outcome: 'other_subscription', user };
    }

    const mapped = mapStripeStatus(sub.status);
    const scheduledCancel = !!(sub.cancel_at_period_end || sub.cancel_at);
    let status = mapped;
    if (scheduledCancel && (mapped === 'active' || mapped === 'trial')) status = 'cancelled';

    user.stripeSubscriptionId = sub.id;
    user.cancelAtPeriodEnd = scheduledCancel;
    if (status) user.subscriptionStatus = status;
    if (sub.trial_end) user.trialEndsAt = toDate(sub.trial_end);
    const periodEnd = getSubscriptionPeriodEnd(sub);
    if (periodEnd) user.subscriptionExpiry = periodEnd;
    const plan = planFromSubscription(sub);
    if (plan) user.plan = plan;

    const changed = user.isModified();
    if (changed) await user.save({ validateBeforeSave: false });

    let cancellationLogged = false;
    if (scheduledCancel) {
        const accessEndsAt = toDate(sub.cancel_at) || periodEnd || null;
        cancellationLogged = await logCancellation(user, sub, { plan: plan || user.plan, accessEndsAt, by });
    }

    if (notify) {
        // A scheduled cancellation still has paid access until the period
        // ends, so Discord roles stay on until then.
        if (changed) syncDiscordRoles(user, status === 'cancelled' ? 'active' : user.subscriptionStatus);
        if (cancellationLogged) {
            notifyLifecycle('subscription_cancelled', { name: user.name, email: user.email, plan: plan || user.plan });
        }
    }
    return { outcome: changed ? 'updated' : 'unchanged', changed, cancellationLogged, user };
}

/** Backfills the "trial started" feed entry for a subscription that had a trial. */
async function ensureTrialStartedLogged(user, sub) {
    if (!sub || !(sub.trial_start || sub.trial_end)) return false;
    const startedAt = toDate(sub.trial_start) || toDate(sub.start_date) || toDate(sub.created) || new Date();
    const windowMs = 2 * 24 * HOUR;
    return recordActivity({
        type: 'trial_started',
        user,
        message: `${user.name} started a ${planFromSubscription(sub) || user.plan} trial`,
        meta: {
            plan: planFromSubscription(sub) || user.plan,
            stripeSubscriptionId: sub.id,
            trialEndsAt: toDate(sub.trial_end),
        },
        createdAt: startedAt,
        dedupeKey: `trial:${sub.id}`,
        // The signup route logs its own trial_started entry (without the
        // Stripe id) — match it by user + time so the feed isn't doubled.
        legacy: {
            $or: [
                { 'meta.stripeSubscriptionId': sub.id },
                { userId: user._id, createdAt: { $gte: new Date(startedAt.getTime() - windowMs), $lte: new Date(startedAt.getTime() + windowMs) } },
            ],
        },
    });
}

module.exports = {
    mapStripeStatus,
    findUserByStripe,
    recordActivity,
    applyPaidInvoice,
    applyPaymentFailed,
    applySubscriptionState,
    applySubscriptionEnded,
    ensureTrialStartedLogged,
    ENDED_STATUSES,
};
