const mongoose = require('mongoose')
const betSchema = new mongoose.Schema({
  user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
  game: { type: String, required: true, trim: true },
  sport: { type: String, default: 'Other' },
  market: { type: String, required: true, trim: true },
  book: { type: String, required: true, trim: true },
  odds: { type: Number, required: true },
  stake: { type: Number, required: true, min: 0 },
  result: { type: String, enum: ['win','loss','pending','void'], default: 'pending' },
  profit: { type: Number, default: 0 },
  betType: { type: String, enum: ['standard','arbitrage','ev','middle','bonus'], default: 'standard' },
  notes: { type: String, maxlength: 500 },
  date: { type: Date, default: Date.now },
})
betSchema.pre('save', function(next) {
  if (this.result === 'win') {
    this.profit = this.odds > 0 ? Math.round((this.stake * this.odds) / 100) : Math.round((this.stake * 100) / Math.abs(this.odds))
  } else if (this.result === 'loss') { this.profit = -this.stake }
  else if (this.result === 'void') { this.profit = 0 }
  next()
})
module.exports = mongoose.model('Bet', betSchema)
