/**
 * auth.js — Authentication routes
 *
 * POST /api/auth/register          — register with name, email, phone, password
 * POST /api/auth/login             — login
 * GET  /api/auth/me                — get current user
 * PUT  /api/auth/profile           — update profile (name, phone, password)
 * POST /api/auth/forgot-password   — send reset email via Gmail
 * POST /api/auth/reset-password    — reset password with token from email
 */

const router  = require('express').Router()
const jwt     = require('jsonwebtoken')
const crypto  = require('crypto')
const User    = require('../models/User')
const { protect }  = require('../middleware/auth')
const { sendPasswordResetEmail, sendWelcomeEmail } = require('../services/emailService')

const sign = (id) => jwt.sign({ id }, process.env.JWT_SECRET, {
  expiresIn: process.env.JWT_EXPIRES_IN || '7d',
})

// ── POST /api/auth/register ───────────────────────────────────────────────
router.post('/register', async (req, res) => {
  try {
    const { name, email, phone, password } = req.body

    // Validation
    if (!name?.trim())     return res.status(400).json({ success: false, message: 'Name is required.' })
    if (!email?.trim())    return res.status(400).json({ success: false, message: 'Email is required.' })
    if (!password)         return res.status(400).json({ success: false, message: 'Password is required.' })
    if (password.length < 6) return res.status(400).json({ success: false, message: 'Password must be at least 6 characters.' })

    // Phone validation (optional but validated if provided)
    if (phone) {
      const cleaned = phone.replace(/[\s\-\(\)]/g, '')
      if (!/^\+?[0-9]{7,15}$/.test(cleaned)) {
        return res.status(400).json({ success: false, message: 'Invalid phone number format.' })
      }
    }

    // Check duplicate email
    if (await User.findOne({ email: email.toLowerCase() })) {
      return res.status(400).json({ success: false, message: 'An account with this email already exists.' })
    }

    // Create user (password is hashed by pre-save hook)
    const trialEndsAt = new Date(Date.now() + 14 * 24 * 60 * 60 * 1000)
    const user = await User.create({
      name:               name.trim(),
      email:              email.toLowerCase().trim(),
      phone:              phone?.trim() || null,
      password,
      trialEndsAt,
      subscriptionStatus: 'trial',
    })

    // Send welcome email (non-blocking — don't fail registration if email fails)
    sendWelcomeEmail(user.email, user.name, user.plan).catch(err =>
      console.warn('[Email] Welcome email failed:', err.message)
    )

    res.status(201).json({
      success: true,
      token:   sign(user._id),
      user:    user.toPublicJSON(),
    })
  } catch (e) {
    console.error('Register error:', e)
    res.status(500).json({ success: false, message: e.message })
  }
})

// ── POST /api/auth/login ──────────────────────────────────────────────────
router.post('/login', async (req, res) => {
  try {
    const { email, password } = req.body
    if (!email || !password) {
      return res.status(400).json({ success: false, message: 'Email and password required.' })
    }

    const user = await User.findOne({ email: email.toLowerCase() }).select('+password')
    if (!user || !(await user.comparePassword(password))) {
      return res.status(401).json({ success: false, message: 'Invalid email or password.' })
    }

    if (!user.isActive) {
      return res.status(403).json({ success: false, message: 'Account has been deactivated. Contact support.' })
    }

    user.lastLogin  = new Date()
    user.loginCount += 1
    await user.save({ validateBeforeSave: false })

    res.json({ success: true, token: sign(user._id), user: user.toPublicJSON() })
  } catch (e) {
    res.status(500).json({ success: false, message: e.message })
  }
})

// ── GET /api/auth/me ──────────────────────────────────────────────────────
router.get('/me', protect, (req, res) => {
  res.json({ success: true, user: req.user.toPublicJSON() })
})

// ── PUT /api/auth/profile ─────────────────────────────────────────────────
router.put('/profile', protect, async (req, res) => {
  try {
    const { name, phone, password, currentPassword } = req.body

    if (name)  req.user.name  = name.trim()
    if (phone) req.user.phone = phone.trim()

    // Password change requires current password verification
    if (password) {
      if (!currentPassword) {
        return res.status(400).json({ success: false, message: 'Current password required to set new password.' })
      }
      const userWithPw = await User.findById(req.user._id).select('+password')
      if (!(await userWithPw.comparePassword(currentPassword))) {
        return res.status(401).json({ success: false, message: 'Current password is incorrect.' })
      }
      if (password.length < 6) {
        return res.status(400).json({ success: false, message: 'New password must be at least 6 characters.' })
      }
      req.user.password = password
    }

    await req.user.save()
    res.json({ success: true, user: req.user.toPublicJSON() })
  } catch (e) {
    res.status(500).json({ success: false, message: e.message })
  }
})

// ── POST /api/auth/forgot-password ───────────────────────────────────────
// Sends a password reset link to the user's Gmail
router.post('/forgot-password', async (req, res) => {
  try {
    const { email } = req.body
    if (!email) return res.status(400).json({ success: false, message: 'Email is required.' })

    const user = await User.findOne({ email: email.toLowerCase() })

    // Always return success even if email not found (security: don't reveal if email exists)
    if (!user) {
      return res.json({
        success: true,
        message: 'If an account exists for that email, a reset link has been sent.',
      })
    }

    // Generate reset token — raw token goes in email, hashed stored in DB
    const rawToken = user.createPasswordResetToken()
    await user.save({ validateBeforeSave: false })

    // Send reset email
    try {
      await sendPasswordResetEmail(user.email, user.name, rawToken)
      res.json({
        success: true,
        message: 'Password reset link sent to your email. Check your inbox (and spam folder).',
      })
    } catch (emailErr) {
      // Roll back token if email failed
      user.passwordResetToken   = undefined
      user.passwordResetExpires = undefined
      await user.save({ validateBeforeSave: false })
      console.error('Password reset email failed:', emailErr.message)
      res.status(500).json({ success: false, message: 'Failed to send reset email. Please try again.' })
    }
  } catch (e) {
    res.status(500).json({ success: false, message: e.message })
  }
})

// ── POST /api/auth/reset-password ────────────────────────────────────────
// Validates the token from email and sets new password
router.post('/reset-password', async (req, res) => {
  try {
    const { token, password } = req.body

    if (!token)    return res.status(400).json({ success: false, message: 'Reset token is required.' })
    if (!password) return res.status(400).json({ success: false, message: 'New password is required.' })
    if (password.length < 6) return res.status(400).json({ success: false, message: 'Password must be at least 6 characters.' })

    // Hash the raw token from the URL to compare with DB
    const hashedToken = crypto.createHash('sha256').update(token).digest('hex')

    // Find user with matching non-expired token
    const user = await User.findOne({
      passwordResetToken:   hashedToken,
      passwordResetExpires: { $gt: new Date() }, // not expired
    }).select('+passwordResetToken +passwordResetExpires')

    if (!user) {
      return res.status(400).json({
        success: false,
        message: 'Reset link is invalid or has expired. Please request a new one.',
      })
    }

    // Set new password (pre-save hook will hash it)
    user.password             = password
    user.passwordResetToken   = undefined
    user.passwordResetExpires = undefined
    await user.save()

    res.json({
      success: true,
      message: 'Password reset successfully. You can now log in with your new password.',
      token:   sign(user._id),
      user:    user.toPublicJSON(),
    })
  } catch (e) {
    res.status(500).json({ success: false, message: e.message })
  }
})

module.exports = router
