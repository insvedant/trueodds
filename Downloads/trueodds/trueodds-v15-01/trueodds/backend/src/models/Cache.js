const mongoose = require('mongoose')

/**
 * Cache Model
 * Stores API responses in MongoDB so we don't burn through free tier limits.
 * Each document expires automatically via MongoDB TTL index.
 *
 * Usage:
 *   await Cache.set('odds:NFL', data, 900)   // cache for 15 min
 *   const hit = await Cache.get('odds:NFL')  // null if expired/missing
 */
const cacheSchema = new mongoose.Schema({
  key:       { type: String, required: true, unique: true, index: true },
  data:      { type: mongoose.Schema.Types.Mixed, required: true },
  source:    { type: String, default: 'api' },         // 'api' | 'mock'
  fetchedAt: { type: Date, default: Date.now },
  expiresAt: { type: Date, required: true, index: { expireAfterSeconds: 0 } },
  requestsUsed: { type: Number, default: 1 },          // API quota tracking
})

cacheSchema.statics.get = async function(key) {
  const doc = await this.findOne({ key, expiresAt: { $gt: new Date() } })
  return doc ? doc.data : null
}

cacheSchema.statics.set = async function(key, data, ttlSeconds = 900, source = 'api') {
  const expiresAt = new Date(Date.now() + ttlSeconds * 1000)
  await this.findOneAndUpdate(
    { key },
    { key, data, source, fetchedAt: new Date(), expiresAt },
    { upsert: true, new: true }
  )
}

cacheSchema.statics.del = async function(key) {
  await this.deleteOne({ key })
}

module.exports = mongoose.model('Cache', cacheSchema)
