const Stripe = require('stripe');
const stripe = Stripe(process.env.STRIPE_SECRET_KEY || 'sk_test_REPLACE_WITH_YOUR_STRIPE_SECRET_KEY');
const TRIAL_DAYS = 7;
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
    try {
        const Promotion = require('../models/Promotion');
        const promo = await Promotion.getSingleton();
        const expired = promo.endsAt && new Date(promo.endsAt) < new Date();
        const saleLive = promo.active && !expired;
        if (saleLive) {
            const basePlan = planId.replace('_yearly', '');
            const couponId = promo.coupons?.[basePlan];
            if (couponId) {
                const stripeCoupon = await stripe.coupons.retrieve(couponId);
                if (stripeCoupon.valid)
                    coupon = couponId;
            }
        }
    }
    catch (e) {
        console.warn('[Promotion] coupon lookup failed, proceeding at full price:', e.message);
    }
    const subscription = await stripe.subscriptions.create({
        customer: customerId,
        items: [{ price: PRICE_IDS[planId] }],
        trial_period_days: TRIAL_DAYS,
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
async function createSetupIntent(stripeCustomerId) {
    return stripe.setupIntents.create({
        customer: stripeCustomerId,
        payment_method_types: ['card', 'paypal'],
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
function constructWebhookEvent(rawBody, signature) {
    const secret = process.env.STRIPE_WEBHOOK_SECRET || 'whsec_REPLACE_WITH_YOUR_WEBHOOK_SECRET';
    return stripe.webhooks.constructEvent(rawBody, signature, secret);
}
module.exports = {
    stripe,
    PLAN_META,
    TRIAL_DAYS,
    createSubscriptionWithTrial,
    cancelSubscription,
    createSetupIntent,
    createOneOffCharge,
    getSubscription,
    constructWebhookEvent,
};
