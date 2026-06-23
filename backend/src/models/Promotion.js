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

  // Stripe Coupon IDs (NOT promotion codes — these are applied directly
  // server-side via `coupon:` on subscription create, no customer-facing
  // code needed). One per plan, since each plan has a different base price.
  coupons: {
    basic:    { type: String, default: '' },
    gold:     { type: String, default: '' },
    platinum: { type: String, default: '' },
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
