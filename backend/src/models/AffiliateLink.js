const mongoose = require('mongoose')

const affiliateLinkSchema = new mongoose.Schema({
  sportsbook_id: { type: String, required: true, unique: true },
  displayName:   { type: String, required: true },
  affiliateUrl:  { type: String, required: true },
  baseUrl:       { type: String, required: true },
  logoColor:     { type: String, default: '#333' },
  markets:       { type: [String], default: ['US', 'CA'] },
  active:        { type: Boolean, default: true },
  clicks:        { type: Number,  default: 0 },
  lastClickAt:   { type: Date,    default: null },
  updatedAt:     { type: Date,    default: Date.now },
})

module.exports = mongoose.model('AffiliateLink', affiliateLinkSchema)
