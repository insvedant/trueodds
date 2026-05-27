const mongoose = require('mongoose')
const bcrypt   = require('bcryptjs')
const crypto   = require('crypto')

const userSchema = new mongoose.Schema({
  name:     { type: String, required: true, trim: true },
  email:    { type: String, required: true, unique: true, lowercase: true, trim: true },
  password: { type: String, required: true, minlength: 6, select: false },
  phone:    { type: String, trim: true, default: null },  // ← NEW
  role:     { type: String, enum: ['user','admin'], default: 'user' },

  // Plan & subscription
  plan:               { type: String, enum: ['free','basic','gold','platinum'], default: 'free' },
  subscriptionStatus: { type: String, enum: ['active','inactive','cancelled','trial','past_due'], default: 'trial' },
  subscriptionStartDate: Date,
  subscriptionExpiry:    Date,
  trialEndsAt:           Date,

  // Stripe IDs
  stripeCustomerId:      { type: String, default: null },
  stripeSubscriptionId:  { type: String, default: null },
  stripePaymentMethodId: { type: String, default: null },

  // Payment history
  totalPaid: { type: Number, default: 0 },
  payments:  [{
    amount:          Number,
    plan:            String,
    stripeInvoiceId: String,
    date:   { type: Date, default: Date.now },
    status: { type: String, default: 'completed' },
  }],

  // ── Password Reset ───────────────────────────────────────────────────────
  // Stores a secure random token + expiry for password reset via email
  passwordResetToken:   { type: String, select: false },  // hashed token in DB
  passwordResetExpires: { type: Date,   select: false },  // expires in 10 minutes

  // Referral program
  referralCode:       { type: String, unique: true, sparse: true },
  referredBy:         { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
  referralCount:      { type: Number, default: 0 },   // paying referrals
  referralRewards:    { type: Number, default: 0 },   // months earned
  freeMonthsGranted:  { type: Number, default: 0 },

  isActive:   { type: Boolean, default: true },
  lastLogin:  Date,
  loginCount: { type: Number, default: 0 },
  createdAt:  { type: Date, default: Date.now },
})

// ── Hash password before save ────────────────────────────────────────────
userSchema.pre('save', async function(next) {
  if (!this.isModified('password')) return next()
  this.password = await bcrypt.hash(this.password, 12)  // bcrypt rounds=12
  next()
})

// ── Compare password ─────────────────────────────────────────────────────
userSchema.methods.comparePassword = async function(candidate) {
  return bcrypt.compare(candidate, this.password)
}

// ── Generate password reset token ────────────────────────────────────────
// Returns the RAW token (sent in email link)
// Stores the HASHED token in DB (so DB leak can't be used to reset)
userSchema.methods.createPasswordResetToken = function() {
  const rawToken    = crypto.randomBytes(32).toString('hex')
  // Hash with SHA-256 before storing — raw token goes in email only
  this.passwordResetToken   = crypto.createHash('sha256').update(rawToken).digest('hex')
  this.passwordResetExpires = new Date(Date.now() + 10 * 60 * 1000) // 10 minutes
  return rawToken
}

// ── Public JSON (never expose password, tokens) ───────────────────────────
  alertPrefs: {
    emailAlerts:    { type: Boolean, default: true },   // master on/off
    arbThreshold:   { type: Number,  default: 2.0 },    // min % to trigger
    evThreshold:    { type: Number,  default: 3.0 },    // min EV% to trigger
    sports:         { type: [String], default: [] },    // [] = all sports
    hotDealsOnly:   { type: Boolean, default: false },  // only 5%+ deals
    lastEmailedAt:  { type: Date,    default: null },
  },

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
    stripeCustomerId:   this.stripeCustomerId,
    hasPaymentMethod:   !!this.stripePaymentMethodId,
    referralCode:       this.referralCode,
    referralCount:      this.referralCount,
    referralRewards:    this.referralRewards,
    alertPrefs:         this.alertPrefs,
    createdAt:          this.createdAt,
    lastLogin:          this.lastLogin,
  }
}

module.exports = mongoose.model('User', userSchema)

