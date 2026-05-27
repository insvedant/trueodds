const router = require('express').Router()
const User = require('../models/User')
const { constructWebhookEvent } = require('../services/stripeService')

const REFERRAL_THRESHOLD = 50

router.post('/stripe', require('express').raw({ type: 'application/json' }), async (req, res) => {
  const sig = req.headers['stripe-signature']
  let event
  try {
    event = constructWebhookEvent(req.body, sig)
  } catch (err) {
    return res.status(400).send(`Webhook Error: ${err.message}`)
  }

  try {
    switch (event.type) {
      case 'customer.subscription.trial_will_end': {
        const sub = event.data.object
        const user = await User.findOne({ stripeCustomerId: sub.customer })
        if (user) {
          console.log(`Trial ending soon for ${user.email}`)
        }
        break
      }

      case 'invoice.payment_succeeded': {
        const invoice = event.data.object
        if (invoice.billing_reason === 'subscription_create') break

        const user = await User.findOne({ stripeCustomerId: invoice.customer })
        if (!user) break

        const amount = invoice.amount_paid / 100
        const prevTotalPaid = user.totalPaid || 0

        user.subscriptionStatus = 'active'
        user.subscriptionExpiry = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000)
        user.totalPaid = prevTotalPaid + amount
        user.payments.push({
          amount,
          plan: user.plan,
          stripeInvoiceId: invoice.id,
          status: 'completed',
        })
        await user.save({ validateBeforeSave: false })

        if (user.referredBy && prevTotalPaid < REFERRAL_THRESHOLD && user.totalPaid >= REFERRAL_THRESHOLD) {
          const referrer = await User.findById(user.referredBy)
          if (referrer) {
            referrer.referralRewards = (referrer.referralRewards || 0) + 1
            referrer.referralCount = (referrer.referralCount || 0) + 1
            const baseDate = referrer.subscriptionExpiry && referrer.subscriptionExpiry > new Date()
              ? referrer.subscriptionExpiry
              : new Date()
            referrer.subscriptionExpiry = new Date(baseDate.getTime() + 30 * 24 * 60 * 60 * 1000)
            await referrer.save({ validateBeforeSave: false })
          }
        }
        break
      }

      case 'invoice.payment_failed': {
        const invoice = event.data.object
        const user = await User.findOne({ stripeCustomerId: invoice.customer })
        if (user) {
          user.subscriptionStatus = 'past_due'
          await user.save({ validateBeforeSave: false })
        }
        break
      }

      case 'customer.subscription.deleted': {
        const sub = event.data.object
        const user = await User.findOne({ stripeCustomerId: sub.customer })
        if (user) {
          user.subscriptionStatus = 'cancelled'
          user.plan = 'free'
          await user.save({ validateBeforeSave: false })
        }
        break
      }

      case 'customer.subscription.updated': {
        const sub = event.data.object
        const user = await User.findOne({ stripeSubscriptionId: sub.id })
        if (user) {
          if (sub.status === 'active') user.subscriptionStatus = 'active'
          if (sub.status === 'trialing') user.subscriptionStatus = 'trial'
          if (sub.status === 'past_due') user.subscriptionStatus = 'past_due'
          if (sub.trial_end) user.trialEndsAt = new Date(sub.trial_end * 1000)
          await user.save({ validateBeforeSave: false })
        }
        break
      }

      default:
        console.log(`Unhandled webhook event: ${event.type}`)
    }
  } catch (err) {
    console.error('Webhook handler error:', err)
    return res.status(500).json({ error: 'Webhook processing failed.' })
  }

  res.json({ received: true })
})

module.exports = router
