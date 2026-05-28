const mongoose = require('mongoose')

const alertSchema = new mongoose.Schema({
  user:     { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  type:     { type: String, enum: ['arb','ev','line','sharp','system'], default: 'system' },
  title:    { type: String, required: true },
  message:  { type: String, default: '' },
  value:    String,
  sport:    String,
  eventId:  String,
  read:     { type: Boolean, default: false },
  createdAt:{ type: Date, default: Date.now },
})

alertSchema.index({ user: 1, createdAt: -1 })

module.exports = mongoose.model('Alert', alertSchema)
