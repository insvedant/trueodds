const mongoose = require('mongoose')
const bcrypt   = require('bcryptjs')
const crypto   = require('crypto')

const userSchema = new mongoose.Schema({
  name:               { type: String, required: true, trim: true },
  email:              { type: String, required: true, unique: true, lowercase: true, trim: true },
  phone:              { type: String, default: null },
  password:           { type: String, required: true, select: false, minlength: 6 },
  role:               { type: String, enum: ['user','admin'], default: 'user' },
  plan:               { type: String, enum: ['free','basic','gold','platinum'], default: 'free' },
  subscriptionStatus: { type: String, enum: ['active','inactive','cancelled','trial','past_due'], default: 'trial' },
  subscriptionExpiry: Date,
  trialEndsAt:        Date,
  stripeCustomerId:   String,
  stripeSubscriptionId: String,
  totalPaid:          { type: Number, default: 0 },
  payments: [{
    amount:          Number,
    plan:            String,
    stripeInvoiceId: String,
    status:          String,
    date:            { type: Date, default: Date.now },
  }],
  passwordResetToken:   { type: String, select: false },
  passwordResetExpires: { type: Date,   select: false },
  referralCode:       { type: String, unique: true, sparse: true },
  referredBy:         { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
  referralCount:      { type: Number, default: 0 },
  referralRewards:    { type: Number, default: 0 },
  freeMonthsGranted:  { type: Number, default: 0 },
  alertPrefs: {
    emailAlerts:   { type: Boolean, default: true },
    arbThreshold:  { type: Number,  default: 2.0 },
    evThreshold:   { type: Number,  default: 3.0 },
    sports:        { type: [String], default: () => [] },
    hotDealsOnly:  { type: Boolean, default: false },
    lastEmailedAt: { type: Date,    default: null },
  },
  isActive:   { type: Boolean, default: true },
  lastLogin:  Date,
  loginCount: { type: Number, default: 0 },
  createdAt:  { type: Date, default: Date.now },
})

userSchema.pre('save', async function(next) {
  if (!this.isModified('password')) return next()
  this.password = await bcrypt.hash(this.password, 12)
  next()
})

userSchema.methods.comparePassword = async function(candidatePassword) {
  const userWithPw = await this.constructor.findById(this._id).select('+password')
  return bcrypt.compare(candidatePassword, userWithPw.password)
}

userSchema.methods.createPasswordResetToken = function() {
  const rawToken = crypto.randomBytes(32).toString('hex')
  this.passwordResetToken   = crypto.createHash('sha256').update(rawToken).digest('hex')
  this.passwordResetExpires = new Date(Date.now() + 10 * 60 * 1000)
  return rawToken
}

userSchema.methods.toPublicJSON = function() {
  return {
    id:                 this._id,
    name:               this.name,
    email:              this.email,
    phone:              this.phone,
    role:               this.role,
    plan:               this.plan,
    subscriptionStatus: this.subscriptionStatus,
    subscriptionExpiry: this.subscriptionExpiry,
    trialEndsAt:        this.trialEndsAt,
    totalPaid:          this.totalPaid,
    referralCode:       this.referralCode,
    referralCount:      this.referralCount,
    referralRewards:    this.referralRewards,
    alertPrefs:         this.alertPrefs,
    createdAt:          this.createdAt,
  }
}

module.exports = mongoose.model('User', userSchema)
