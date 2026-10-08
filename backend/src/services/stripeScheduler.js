/**
 * stripeScheduler.js — keeps MongoDB in step with Stripe without anyone
 * having to click a button.
 *
 * Webhooks are the fast path. This is the guarantee: on boot and then every
 * STRIPE_SYNC_INTERVAL_MIN minutes (default 15) it reconciles recent invoices
 * and all subscriptions. If a webhook is misconfigured, rejected, or lost,
 * the admin panel is at most one interval behind reality instead of stale
 * forever.
 *
 * Env:
 *   STRIPE_AUTO_SYNC=false         disable the schedule entirely
 *   STRIPE_SYNC_INTERVAL_MIN=15    minutes between runs
 *   STRIPE_SYNC_WINDOW_DAYS=45     how far back each scheduled run scans invoices
 */
const StripeStatus = require('../models/StripeStatus');
const { isStripeConfigured } = require('./stripeService');
const { syncStripeToMongo } = require('./stripeSync');

let running = false;

async function runStripeSync({ source = 'scheduled', sinceDays } = {}) {
    if (!isStripeConfigured()) {
        return { skipped: true, reason: 'STRIPE_SECRET_KEY is not configured' };
    }
    if (running) {
        return { skipped: true, reason: 'another sync is already running' };
    }
    running = true;
    try {
        const result = await syncStripeToMongo({ sinceDays });
        await StripeStatus.recordSync(source, result).catch(() => { });
        return result;
    }
    catch (err) {
        console.error(`[Stripe Sync] ${source} run failed:`, err.message);
        await StripeStatus.recordSyncError(source, err.message).catch(() => { });
        throw err;
    }
    finally {
        running = false;
    }
}

function startStripeSyncSchedule() {
    if (String(process.env.STRIPE_AUTO_SYNC).toLowerCase() === 'false') {
        console.log('[Stripe Sync] Auto-sync disabled (STRIPE_AUTO_SYNC=false).');
        return;
    }
    const intervalMin = Math.max(1, Number(process.env.STRIPE_SYNC_INTERVAL_MIN) || 15);
    const windowDays = Math.max(1, Number(process.env.STRIPE_SYNC_WINDOW_DAYS) || 45);

    const tick = (source) => runStripeSync({ source, sinceDays: windowDays })
        .then(r => { if (r && !r.skipped) console.log(`[Stripe Sync] ${source}: +${r.paymentsAdded} payments, ${r.subscriptionsUpdated} subscriptions updated, ${r.cancellationsLogged} cancellations logged`); })
        .catch(() => { /* already logged + recorded */ });

    // First run shortly after boot so a restart immediately self-corrects.
    setTimeout(() => tick('startup'), 30 * 1000);
    setInterval(() => tick('scheduled'), intervalMin * 60 * 1000);
    console.log(`[Stripe Sync] ✅ Auto-sync scheduled every ${intervalMin} min (scans last ${windowDays} days of invoices).`);
}

module.exports = { startStripeSyncSchedule, runStripeSync };
