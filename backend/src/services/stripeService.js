/**
 * stripeService.js
 * ─────────────────────────────────────────────────────────────────────────
 * All Stripe interactions live here.
 * Replace STRIPE_SECRET_KEY and STRIPE_WEBHOOK_SECRET in .env when ready.
 *
 * PRICE IDs — create these in your Stripe dashboard:
 *   Dashboard → Products → Add Product → Add Price (recurring monthly)
 *   Then paste the price_xxx IDs below in .env as:
 *     STRIPE_PRICE_GOLD=price_xxx
 *     STRIPE_PRICE_PLATINUM=price_xxx
 */

const Stripe = require('stripe')

// Demo key placeholder — replace with real key from stripe.com/dashboard
const stripe = Stripe(
  process.env.STRIPE_SECRET_KEY || 'sk_test_REPLACE_WITH_YOUR_STRIPE_SECRET_KEY'
)

const TRIAL_DAYS = 7

// Price IDs — set in .env when you have them
const PRICE_IDS = {
  gold:     process.env.STRIPE_PRICE_GOLD     || 'price_REPLACE_GOLD_MONTHLY',
  platinum: process.env.STRIPE_PRICE_PLATINUM || 'price_REPLACE_PLATINUM_MONTHLY',
}

// Plan metadata for display / fallback
const PLAN_META = {
  gold:     { name: 'Gold',     price: 15.99 },
  platinum: { name: 'Platinum', price: 49.99 },
}

/**
 * Create a Stripe customer and start a subscription with trial.
 * Returns { customerId, subscriptionId, clientSecret, trialEnd }
 */
async function createSubscriptionWithTrial({ name, email, planId, paymentMethodId }) {
  // 1. Create customer
  const customer = await stripe.customers.create({
    name,
    email,
    payment_method: paymentMethodId,
    invoice_settings: { default_payment_method: paymentMethodId },
    metadata: { plan: planId },
  })

  // 2. Attach payment method to customer
  await stripe.paymentMethods.attach(paymentMethodId, { customer: customer.id })

  // 3. Create subscription with trial
  const subscription = await stripe.subscriptions.create({
    customer:    customer.id,
    items:       [{ price: PRICE_IDS[planId] }],
    trial_period_days: TRIAL_DAYS,
    payment_settings: {
      payment_method_types: ['card'],
      save_default_payment_method: 'on_subscription',
    },
    expand: ['latest_invoice.payment_intent'],
    metadata: { plan: planId },
  })

  const trialEnd = new Date(subscription.trial_end * 1000)

  return {
    customerId:     customer.id,
    subscriptionId: subscription.id,
    trialEnd,
    status:         subscription.status, // 'trialing'
  }
}

/**
 * Cancel a subscription immediately.
 */
async function cancelSubscription(stripeSubscriptionId) {
  return stripe.subscriptions.cancel(stripeSubscriptionId)
}

/**
 * Create a SetupIntent — used when updating card without charging.
 */
async function createSetupIntent(stripeCustomerId) {
  return stripe.setupIntents.create({
    customer: stripeCustomerId,
    payment_method_types: ['card'],
  })
}

/**
 * Create a PaymentIntent for a one-off charge (Day Pass etc.)
 */
async function createOneOffCharge({ stripeCustomerId, amount, description }) {
  return stripe.paymentIntents.create({
    amount:   amount * 100, // cents
    currency: 'usd',
    customer: stripeCustomerId,
    description,
    confirm:  true,
    automatic_payment_methods: { enabled: true, allow_redirects: 'never' },
  })
}

/**
 * Retrieve a subscription.
 */
async function getSubscription(subscriptionId) {
  return stripe.subscriptions.retrieve(subscriptionId)
}

/**
 * Construct a webhook event from raw body + signature.
 * Call this in the webhook route with the raw request body.
 */
function constructWebhookEvent(rawBody, signature) {
  const secret = process.env.STRIPE_WEBHOOK_SECRET || 'whsec_REPLACE_WITH_YOUR_WEBHOOK_SECRET'
  return stripe.webhooks.constructEvent(rawBody, signature, secret)
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
}
