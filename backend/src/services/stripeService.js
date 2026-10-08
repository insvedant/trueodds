const Stripe = require('stripe');
const stripe = Stripe(process.env.STRIPE_SECRET_KEY || 'sk_test_REPLACE_WITH_YOUR_STRIPE_SECRET_KEY');
const TRIAL_DAYS = 30;
const PRICE_IDS = {
    basic: process.env.STRIPE_PRICE_BASIC_MONTHLY || 'price_REPLACE_BASIC_MONTHLY',
    gold: process.env.STRIPE_PRICE_GOLD_MONTHLY || 'price_REPLACE_GOLD_MONTHLY',
    platinum: process.env.STRIPE_PRICE_PLATINUM_MONTHLY || 'price_REPLACE_PLATINUM_MONTHLY',
    basic_yearly: process.env.STRIPE_PRICE_BASIC_YEARLY || 'price_REPLACE_BASIC_YEARLY',
    gold_yearly: process.env.STRIPE_PRICE_GOLD_YEARLY || 'price_REPLACE_GOLD_YEARLY',
    platinum_yearly: process.env.STRIPE_PRICE_PLATINUM_YEARLY || 'price_REPLACE_PLATINUM_YEARLY',
};
const PLAN_META = {
    basic: { name: 'Basic', price: 15.99, yearlyPrice: 12.99, yearlyTotal: 155.88 },
    gold: { name: 'Gold', price: 49.99, yearlyPrice: 39.99, yearlyTotal: 479.88 },
    platinum: { name: 'Platinum', price: 99.99, yearlyPrice: 79.99, yearlyTotal: 959.88 },
};
// customerId and paymentMethodId are expected to already exist and already be
// attached — the frontend collects the card via a real Stripe Elements +
// SetupIntent flow (see routes/subscriptions.js's /init-card-setup) before
// this ever gets called, which is what actually attaches the payment method
// and handles any 3D Secure / SCA challenge. This function only turns that
// already-verified card into a trial subscription.
async function createSubscriptionWithTrial({ customerId, paymentMethodId, planId }) {
    await stripe.customers.update(customerId, {
        invoice_settings: { default_payment_method: paymentMethodId },
    });
    let coupon = undefined;
    let trialDays = TRIAL_DAYS;
    try {
        const Promotion = require('../models/Promotion');
        const promo = await Promotion.getSingleton();
        const expired = promo.endsAt && new Date(promo.endsAt) < new Date();
        const saleLive = promo.active && !expired;
        if (saleLive) {
            const isYearly = planId.endsWith('_yearly');
            const basePlan = planId.replace('_yearly', '');
            const couponId = isYearly ? promo.coupons?.[basePlan]?.yearly : promo.coupons?.[basePlan]?.monthly;
            if (couponId) {
                const stripeCoupon = await stripe.coupons.retrieve(couponId);
                if (stripeCoupon.valid)
                    coupon = couponId;
            }
            if (promo.extendedTrialDays > trialDays)
                trialDays = promo.extendedTrialDays;
        }
    }
    catch (e) {
        console.warn('[Promotion] coupon/trial-length lookup failed, proceeding with defaults:', e.message);
    }
    const subscription = await stripe.subscriptions.create({
        customer: customerId,
        items: [{ price: PRICE_IDS[planId] }],
        trial_period_days: trialDays,
        coupon,
        default_payment_method: paymentMethodId,
        payment_settings: {
            payment_method_types: ['card'],
            save_default_payment_method: 'on_subscription',
        },
        expand: ['latest_invoice.payment_intent'],
        metadata: { plan: planId },
    });
    const trialEnd = new Date(subscription.trial_end * 1000);
    return {
        customerId,
        subscriptionId: subscription.id,
        trialEnd,
        status: subscription.status,
    };
}
async function cancelSubscription(stripeSubscriptionId) {
    return stripe.subscriptions.cancel(stripeSubscriptionId);
}
// Cancels a subscription and tolerates "already gone" instead of throwing, so
// a stale local record can never block a cancellation or leave a customer
// billing because an earlier attempt half-succeeded.
//   atPeriodEnd=false -> stop billing immediately
//   atPeriodEnd=true  -> keep access/billing state until the paid period ends
// Resolves { subscription, alreadyEnded, scheduled }. Any other Stripe error
// is thrown so the caller can refuse to mark the customer cancelled locally.
async function cancelSubscriptionSafe(stripeSubscriptionId, { atPeriodEnd = false } = {}) {
    let current;
    try {
        current = await stripe.subscriptions.retrieve(stripeSubscriptionId);
    }
    catch (err) {
        if (err?.code === 'resource_missing' || /No such subscription/i.test(err?.message || '')) {
            return { subscription: null, alreadyEnded: true, scheduled: false };
        }
        throw err;
    }
    if (['canceled', 'incomplete_expired'].includes(current.status)) {
        return { subscription: current, alreadyEnded: true, scheduled: false };
    }
    if (atPeriodEnd) {
        const updated = await stripe.subscriptions.update(stripeSubscriptionId, { cancel_at_period_end: true });
        return { subscription: updated, alreadyEnded: false, scheduled: true };
    }
    const cancelled = await stripe.subscriptions.cancel(stripeSubscriptionId);
    return { subscription: cancelled, alreadyEnded: false, scheduled: false };
}
async function createSetupIntent(stripeCustomerId) {
    // Card only. The signup / update-card forms collect cards through Stripe
    // Elements (CardNumber/Expiry/Cvc), so 'card' is the only type that can
    // ever be confirmed here. This used to also request 'paypal', which makes
    // Stripe reject the request outright ("The payment method type 'paypal'
    // is invalid") on any account that hasn't enabled PayPal.
    return stripe.setupIntents.create({
        customer: stripeCustomerId,
        payment_method_types: ['card'],
    });
}
async function createOneOffCharge({ stripeCustomerId, amount, description }) {
    return stripe.paymentIntents.create({
        amount: amount * 100,
        currency: 'usd',
        customer: stripeCustomerId,
        description,
        confirm: true,
        automatic_payment_methods: { enabled: true, allow_redirects: 'never' },
    });
}
async function getSubscription(subscriptionId) {
    return stripe.subscriptions.retrieve(subscriptionId);
}
function isStripeConfigured() {
    const key = process.env.STRIPE_SECRET_KEY || '';
    return key.startsWith('sk_') && !key.includes('REPLACE');
}
function getWebhookSecret() {
    const secret = (process.env.STRIPE_WEBHOOK_SECRET || '').trim();
    return secret.startsWith('whsec_') && !secret.includes('REPLACE') ? secret : null;
}
function isWebhookConfigured() {
    return !!getWebhookSecret();
}
function constructWebhookEvent(rawBody, signature) {
    const secret = getWebhookSecret();
    if (!secret) {
        const err = new Error('STRIPE_WEBHOOK_SECRET is missing or still a placeholder');
        err.code = 'WEBHOOK_SECRET_MISSING';
        throw err;
    }
    return stripe.webhooks.constructEvent(rawBody, signature, secret);
}

// ---------------------------------------------------------------------------
// Stripe API-version tolerant readers.
//
// Webhook events are shaped by the API version of the *endpoint* configured
// in the Stripe Dashboard, not by the stripe-node version in package.json.
// Newer API versions moved several fields this code used to read directly:
//   invoice.subscription            -> invoice.parent.subscription_details.subscription
//   subscription.current_period_end -> subscription.items.data[0].current_period_end
// Reading the old locations on a newer version returns undefined with no
// error, which silently skips subscription linking and expiry updates.
// ---------------------------------------------------------------------------
function idOf(value) {
    if (!value) return null;
    return typeof value === 'string' ? value : (value.id || null);
}
function getInvoiceSubscriptionId(invoice) {
    return (
        idOf(invoice?.subscription) ||
        idOf(invoice?.parent?.subscription_details?.subscription) ||
        idOf(invoice?.lines?.data?.[0]?.parent?.subscription_item_details?.subscription) ||
        idOf(invoice?.lines?.data?.[0]?.subscription) ||
        null
    );
}
function getInvoicePeriodEnd(invoice) {
    const end = invoice?.lines?.data?.[0]?.period?.end;
    return end ? new Date(end * 1000) : null;
}
function getSubscriptionPeriodEnd(sub) {
    const end = sub?.current_period_end ?? sub?.items?.data?.[0]?.current_period_end;
    return end ? new Date(end * 1000) : null;
}
// Maps a Stripe price id back to 'basic' | 'gold' | 'platinum' (monthly and
// yearly prices both resolve to the base plan).
function planFromPriceId(priceId) {
    if (!priceId) return null;
    for (const [key, id] of Object.entries(PRICE_IDS)) {
        if (id && id === priceId) return key.replace('_yearly', '');
    }
    return null;
}
function planFromSubscription(sub) {
    const fromPrice = planFromPriceId(sub?.items?.data?.[0]?.price?.id);
    if (fromPrice) return fromPrice;
    const fromMeta = (sub?.metadata?.plan || '').replace('_yearly', '');
    return ['basic', 'gold', 'platinum'].includes(fromMeta) ? fromMeta : null;
}
module.exports = {
    stripe,
    PLAN_META,
    TRIAL_DAYS,
    createSubscriptionWithTrial,
    cancelSubscription,
    cancelSubscriptionSafe,
    createSetupIntent,
    createOneOffCharge,
    getSubscription,
    constructWebhookEvent,
    isStripeConfigured,
    isWebhookConfigured,
    getInvoiceSubscriptionId,
    getInvoicePeriodEnd,
    getSubscriptionPeriodEnd,
    planFromSubscription,
    planFromPriceId,
};
