const router = require('express').Router();
const User = require('../models/User');
const StripeStatus = require('../models/StripeStatus');
const {
    constructWebhookEvent,
    isWebhookConfigured,
    isStripeConfigured,
    getInvoiceSubscriptionId,
} = require('../services/stripeService');
const ledger = require('../services/stripeLedger');

// GET /api/webhook/stripe — health check only.
// Stripe delivers events with POST, so a browser visit (GET) used to fall
// through to the generic 404 and made a correctly-mounted endpoint look
// broken. This reports whether the server is able to accept Stripe events,
// without exposing any secret or event data.
router.get('/', (req, res) => {
    res.json({
        success: true,
        endpoint: '/api/webhook/stripe',
        note: 'Stripe sends events to this URL with POST. This GET is only a health check.',
        stripeKeyConfigured: isStripeConfigured(),
        webhookSecretConfigured: isWebhookConfigured(),
        ready: isStripeConfigured() && isWebhookConfigured(),
    });
});

async function userForInvoice(invoice) {
    return ledger.findUserByStripe({
        subscriptionId: getInvoiceSubscriptionId(invoice),
        customerId: invoice.customer?.id || invoice.customer,
    });
}

async function userForSubscription(sub) {
    return ledger.findUserByStripe({
        subscriptionId: sub.id,
        customerId: sub.customer?.id || sub.customer,
    });
}

router.post('/', async (req, res) => {
    // A missing secret is a server misconfiguration, not a bad request: say so
    // loudly (and record it for the admin panel) instead of failing every
    // delivery with an opaque signature error.
    if (!isWebhookConfigured()) {
        const msg = 'STRIPE_WEBHOOK_SECRET is missing or still a placeholder — cannot verify Stripe events. Add the signing secret (whsec_...) from the Stripe webhook endpoint to backend/.env and restart.';
        console.error(`[Stripe webhook] ${msg}`);
        StripeStatus.recordWebhookError(msg).catch(() => { });
        return res.status(500).json({ error: 'Webhook secret not configured on server.' });
    }

    const signature = req.headers['stripe-signature'];
    if (!signature) {
        return res.status(400).send('Webhook Error: missing Stripe-Signature header');
    }

    let event;
    try {
        event = constructWebhookEvent(req.body, signature);
    }
    catch (err) {
        const msg = `Signature verification failed: ${err.message}`;
        console.error(`[Stripe webhook] ${msg}`);
        StripeStatus.recordWebhookError(msg).catch(() => { });
        return res.status(400).send(`Webhook Error: ${err.message}`);
    }

    try {
        switch (event.type) {
            case 'invoice.payment_succeeded':
            case 'invoice.paid': {
                const invoice = event.data.object;
                const user = await userForInvoice(invoice);
                if (!user) {
                    console.warn(`[Stripe] Payment for unknown customer ${invoice.customer}`);
                    break;
                }
                await ledger.applyPaidInvoice(user, invoice, { updateState: true, notify: true });
                break;
            }

            case 'invoice.payment_failed': {
                const invoice = event.data.object;
                const user = await userForInvoice(invoice);
                if (user) await ledger.applyPaymentFailed(user, invoice, { notify: true });
                break;
            }

            case 'customer.subscription.created':
            case 'customer.subscription.updated': {
                const sub = event.data.object;
                const user = await userForSubscription(sub);
                if (user) await ledger.applySubscriptionState(user, sub, { notify: true });
                break;
            }

            case 'customer.subscription.deleted': {
                const sub = event.data.object;
                const user = await userForSubscription(sub);
                if (user) await ledger.applySubscriptionEnded(user, sub, { notify: true });
                break;
            }

            case 'customer.subscription.trial_will_end': {
                const sub = event.data.object;
                const user = await userForSubscription(sub);
                if (user) console.log(`[Stripe] Trial ending soon for ${user.email}`);
                break;
            }

            default:
                console.log(`[Stripe] Unhandled webhook event: ${event.type}`);
        }
    }
    catch (err) {
        console.error(`[Stripe webhook] handler error for ${event.type}:`, err);
        StripeStatus.recordWebhookError(`${event.type}: ${err.message}`).catch(() => { });
        // Non-2xx makes Stripe retry later — the right outcome for a
        // transient database error.
        return res.status(500).json({ error: 'Webhook processing failed.' });
    }

    StripeStatus.recordWebhook(event.type, event.id).catch(() => { });
    res.json({ received: true });
});

module.exports = router;
