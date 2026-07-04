/**
 * TrueOdds — Promotion / Sale Settings Model
 * Singleton document storing the current promo banner state and the
 * Stripe Coupon IDs to apply at subscription creation time.
 */
const mongoose = require('mongoose')

const promotionSchema = new mongoose.Schema({
  // Master switch — backup safety net independent of Stripe's own expiry.
  // If this is false, the coupon is never applied even if it's still valid
  // on Stripe's side.
  active: { type: Boolean, default: false },

  // Banner text shown on pricing/home page, e.g. "Black Friday Sale"
  title:    { type: String, default: 'Black Friday Sale' },
  subtitle: { type: String, default: 'Limited time — lock in your discount before it ends' },

  // Optional auto end date/time. Banner + coupon application both stop once
  // this passes, even if `active` is still true (in case you forget to flip it).
  endsAt: { type: Date, default: null },

  // Stripe Coupon IDs — one per plan per billing cycle, since you created
  // 6 separate coupons in Stripe (basic/gold/platinum × monthly/yearly).
  // Applied server-side at subscription creation time; customers never
  // see or type these codes.
  coupons: {
    basic_monthly:    { type: String, default: '' },
    basic_yearly:     { type: String, default: '' },
    gold_monthly:     { type: String, default: '' },
    gold_yearly:      { type: String, default: '' },
    platinum_monthly: { type: String, default: '' },
    platinum_yearly:  { type: String, default: '' },
  },

  // Display-only sale prices — what the frontend shows crossed-out vs sale
  // price. These do NOT control what Stripe actually charges; Stripe charges
  // based on the coupon's real discount amount/percent. Keep these numbers
  // in sync with the coupon so the displayed price matches the real charge.
  // Same coupon is applied to both billing cycles — only the display price
  // shown to the user differs by cycle (monthly $/mo vs yearly $/mo billed annually).
  displayPrices: {
    basic:    { monthly: { type: Number, default: 0 }, yearly: { type: Number, default: 0 } },
    gold:     { monthly: { type: Number, default: 0 }, yearly: { type: Number, default: 0 } },
    platinum: { monthly: { type: Number, default: 0 }, yearly: { type: Number, default: 0 } },
  },

  updatedAt: { type: Date, default: Date.now },
}, { collection: 'promotion_settings' })

promotionSchema.statics.getSingleton = async function () {
  let doc = await this.findOne()
  if (!doc) doc = await this.create({})
  return doc
}

module.exports = mongoose.models.Promotion || mongoose.model('Promotion', promotionSchema)
