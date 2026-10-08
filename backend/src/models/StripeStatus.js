const mongoose = require('mongoose');

// Single-document health record for the Stripe integration, so the admin panel
// can answer "is the webhook actually delivering?" instead of leaving that to
// guesswork. Survives restarts (unlike in-memory counters).
const stripeStatusSchema = new mongoose.Schema({
    key: { type: String, default: 'global', unique: true },
    lastWebhookAt: Date,
    lastWebhookType: String,
    lastWebhookEventId: String,
    webhookCount: { type: Number, default: 0 },
    lastWebhookError: String,
    lastWebhookErrorAt: Date,
    lastSyncAt: Date,
    lastSyncSource: String,
    lastSyncResult: mongoose.Schema.Types.Mixed,
    lastSyncError: String,
    lastSyncErrorAt: Date,
}, { collection: 'stripe_status' });

const upsert = (set, inc) => mongoose.model('StripeStatus').findOneAndUpdate(
    { key: 'global' },
    { $set: set, ...(inc ? { $inc: inc } : {}), $setOnInsert: { key: 'global' } },
    { upsert: true, new: true }
);

stripeStatusSchema.statics.getSingleton = async function () {
    return (await this.findOne({ key: 'global' })) || (await this.create({ key: 'global' }));
};
stripeStatusSchema.statics.recordWebhook = function (type, eventId) {
    return upsert({ lastWebhookAt: new Date(), lastWebhookType: type, lastWebhookEventId: eventId }, { webhookCount: 1 });
};
stripeStatusSchema.statics.recordWebhookError = function (message) {
    return upsert({ lastWebhookError: String(message).slice(0, 500), lastWebhookErrorAt: new Date() });
};
stripeStatusSchema.statics.recordSync = function (source, result) {
    return upsert({ lastSyncAt: new Date(), lastSyncSource: source, lastSyncResult: result, lastSyncError: null });
};
stripeStatusSchema.statics.recordSyncError = function (source, message) {
    return upsert({ lastSyncSource: source, lastSyncError: String(message).slice(0, 500), lastSyncErrorAt: new Date() });
};

module.exports = mongoose.models.StripeStatus || mongoose.model('StripeStatus', stripeStatusSchema);
