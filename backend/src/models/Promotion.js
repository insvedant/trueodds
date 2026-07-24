const mongoose = require('mongoose');
const promotionSchema = new mongoose.Schema({
    active: { type: Boolean, default: false },
    title: { type: String, default: 'Black Friday Sale' },
    subtitle: { type: String, default: 'Limited time — lock in your discount before it ends' },
    endsAt: { type: Date, default: null },
    // 0 = use the normal TRIAL_DAYS from stripeService.js. When set and the
    // promotion is active/not-expired, this overrides the trial length for
    // every new signup on every plan — e.g. a weekend "free for a month"
    // campaign. Reverts automatically once endsAt passes, same as the rest
    // of this promotion.
    extendedTrialDays: { type: Number, default: 0 },
    coupons: {
        basic: { monthly: { type: String, default: '' }, yearly: { type: String, default: '' } },
        gold: { monthly: { type: String, default: '' }, yearly: { type: String, default: '' } },
        platinum: { monthly: { type: String, default: '' }, yearly: { type: String, default: '' } },
    },
    displayPrices: {
        basic: { monthly: { type: Number, default: 0 }, yearly: { type: Number, default: 0 } },
        gold: { monthly: { type: Number, default: 0 }, yearly: { type: Number, default: 0 } },
        platinum: { monthly: { type: Number, default: 0 }, yearly: { type: Number, default: 0 } },
    },
    updatedAt: { type: Date, default: Date.now },
}, { collection: 'promotion_settings' });
promotionSchema.statics.getSingleton = async function () {
    let doc = await this.findOne();
    if (!doc)
        doc = await this.create({});
    return doc;
};
module.exports = mongoose.models.Promotion || mongoose.model('Promotion', promotionSchema);
