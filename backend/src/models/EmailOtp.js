const mongoose = require('mongoose');

/**
 * One row per (email, purpose) with an outstanding or recently used one-time code.
 * Only a keyed hash of the code is stored, never the code itself.
 * Rows delete themselves: `purgeAt` has a TTL index, so nothing about a code lingers.
 */
const emailOtpSchema = new mongoose.Schema({
    email: { type: String, required: true, lowercase: true, trim: true },
    purpose: { type: String, required: true, enum: ['register', 'reset'] },
    codeHash: { type: String, default: null },
    expiresAt: { type: Date, required: true },
    attempts: { type: Number, default: 0 },
    lastSentAt: { type: Date, required: true },
    windowStart: { type: Date, required: true },
    sendCount: { type: Number, default: 1 },
    purgeAt: { type: Date, required: true },
});
emailOtpSchema.index({ email: 1, purpose: 1 }, { unique: true });
emailOtpSchema.index({ purgeAt: 1 }, { expireAfterSeconds: 0 });

module.exports = mongoose.model('EmailOtp', emailOtpSchema);
