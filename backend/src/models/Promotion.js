const mongoose = require('mongoose');
const promotionSchema = new mongoose.Schema({
    active: { type: Boolean, default: false },
    title: { type: String, default: 'Black Friday Sale' },
    subtitle: { type: String, default: 'Limited time — lock in your discount before it ends' },
    endsAt: { type: Date, default: null },
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
