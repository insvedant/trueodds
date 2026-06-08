

const router  = require('express').Router()
const jwt     = require('jsonwebtoken')
const crypto  = require('crypto')
const User    = require('../models/User')
const { protect }  = require('../middleware/auth')
const { sendPasswordResetEmail, sendWelcomeEmail } = require('../services/emailService')
const { logActivity } = require('../services/logActivity')

const sign = (id) => jwt.sign({ id }, process.env.JWT_SECRET, {
  expiresIn: process.env.JWT_EXPIRES_IN || '30d',
})

router.post('/register', async (req, res) => {
  try {
    const { name, email, phone, password, referralCode } = req.body

    
    if (!name?.trim())     return res.status(400).json({ success: false, message: 'Name is required.' })
    if (!email?.trim())    return res.status(400).json({ success: false, message: 'Email is required.' })
    if (!password)         return res.status(400).json({ success: false, message: 'Password is required.' })
    if (password.length < 6) return res.status(400).json({ success: false, message: 'Password must be at least 6 characters.' })

    
    if (phone) {
      const cleaned = phone.replace(/[\s\-\(\)]/g, '')
      if (!/^\+?[0-9]{7,15}$/.test(cleaned)) {
        return res.status(400).json({ success: false, message: 'Invalid phone number format.' })
      }
    }

    
    if (await User.findOne({ email: email.toLowerCase() })) {
      return res.status(400).json({ success: false, message: 'An account with this email already exists.' })
    }

    
    let referrerId = null
    if (referralCode) {
      const referrer = await User.findOne({ referralCode: referralCode.toUpperCase() })
      if (referrer) referrerId = referrer._id
    }

    
    const trialEndsAt = new Date(Date.now() + 14 * 24 * 60 * 60 * 1000)
    const user = await User.create({
      name:               name.trim(),
      email:              email.toLowerCase().trim(),
      phone:              phone?.trim() || null,
      password,
      trialEndsAt,
      subscriptionStatus: 'trial',
      referredBy:         referrerId,
    })

    
    sendWelcomeEmail(user.email, user.name, user.plan).catch(err =>
      console.warn('[Email] Welcome email failed:', err.message)
    )

    logActivity({ type:'signup', user, ip: req.ip, message:`New signup: ${user.email}`, meta:{ plan: user.plan, referral: referralCode||null } })

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

router.post('/login', async (req, res) => {
  try {
    const { email, password } = req.body
    if (!email || !password) {
      return res.status(400).json({ success: false, message: 'Email and password required.' })
    }

    const user = await User.findOne({ email: email.toLowerCase() }).select('+password')
    if (!user || !(await user.comparePassword(password))) {
      logActivity({ type:'login_failed', email: email.toLowerCase(), ip: req.ip, status:'failed', message:`Failed login attempt for ${email}`, meta:{ reason: !user ? 'user_not_found' : 'wrong_password' } })
      return res.status(401).json({ success: false, message: 'Invalid email or password.' })
    }

    if (!user.isActive) {
      return res.status(403).json({ success: false, message: 'Account has been deactivated. Contact support.' })
    }

    user.lastLogin  = new Date()
    user.loginCount += 1
    await user.save({ validateBeforeSave: false })

    logActivity({ type: user.role === 'admin' ? 'admin_login' : 'login', user, ip: req.ip, message:`${user.role === 'admin' ? 'Admin' : 'User'} logged in`, meta:{ loginCount: user.loginCount } })

    res.json({ success: true, token: sign(user._id), user: user.toPublicJSON() })
  } catch (e) {
    res.status(500).json({ success: false, message: e.message })
  }
})

router.get('/me', protect, (req, res) => {
  res.json({ success: true, user: req.user.toPublicJSON() })
})

router.put('/profile', protect, async (req, res) => {
  try {
    const { name, phone, password, currentPassword } = req.body

    if (name)  req.user.name  = name.trim()
    if (phone) req.user.phone = phone.trim()

    
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
    if (password) {
      logActivity({ type:'password_changed', user: req.user, ip: req.ip, message:`Password changed by ${req.user.email}` })
    }
    res.json({ success: true, user: req.user.toPublicJSON() })
  } catch (e) {
    res.status(500).json({ success: false, message: e.message })
  }
})

router.post('/change-email', protect, async (req, res) => {
  try {
    const { newEmail, currentPassword } = req.body

    if (!newEmail?.trim())    return res.status(400).json({ success: false, message: 'New email is required.' })
    if (!currentPassword)     return res.status(400).json({ success: false, message: 'Current password is required.' })
    if (!newEmail.includes('@')) return res.status(400).json({ success: false, message: 'Invalid email address.' })

    
    const userWithPw = await User.findById(req.user._id).select('+password')
    if (!(await userWithPw.comparePassword(currentPassword))) {
      return res.status(401).json({ success: false, message: 'Incorrect password.' })
    }

    
    const existing = await User.findOne({ email: newEmail.toLowerCase().trim() })
    if (existing && existing._id.toString() !== req.user._id.toString()) {
      return res.status(400).json({ success: false, message: 'That email is already in use.' })
    }

    req.user.email = newEmail.toLowerCase().trim()
    await req.user.save({ validateBeforeSave: false })

    logActivity({ type:'email_changed', user: req.user, ip: req.ip, message:`Email changed to ${newEmail}`, meta:{ newEmail, role: req.user.role } })
    res.json({ success: true, message: 'Email updated successfully.', user: req.user.toPublicJSON() })
  } catch (e) {
    res.status(500).json({ success: false, message: e.message })
  }
})

router.post('/forgot-password', async (req, res) => {
  try {
    const { email } = req.body
    if (!email) return res.status(400).json({ success: false, message: 'Email is required.' })

    const user = await User.findOne({ email: email.toLowerCase() })

    
    if (!user) {
      return res.json({
        success: true,
        message: 'If an account exists for that email, a reset link has been sent.',
      })
    }

    
    const rawToken = user.createPasswordResetToken()
    await user.save({ validateBeforeSave: false })

    
    try {
      await sendPasswordResetEmail(user.email, user.name, rawToken)
      logActivity({ type:'password_reset_requested', user, ip: req.ip, message:`Password reset requested for ${user.email}` })
      res.json({
        success: true,
        message: 'Password reset link sent to your email. Check your inbox (and spam folder).',
      })
    } catch (emailErr) {
      
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

router.post('/reset-password', async (req, res) => {
  try {
    const { token, password } = req.body

    if (!token)    return res.status(400).json({ success: false, message: 'Reset token is required.' })
    if (!password) return res.status(400).json({ success: false, message: 'New password is required.' })
    if (password.length < 6) return res.status(400).json({ success: false, message: 'Password must be at least 6 characters.' })

    
    const hashedToken = crypto.createHash('sha256').update(token).digest('hex')

    
    const user = await User.findOne({
      passwordResetToken:   hashedToken,
      passwordResetExpires: { $gt: new Date() }, 
    }).select('+passwordResetToken +passwordResetExpires')

    if (!user) {
      return res.status(400).json({
        success: false,
        message: 'Reset link is invalid or has expired. Please request a new one.',
      })
    }

    
    user.password             = password
    user.passwordResetToken   = undefined
    user.passwordResetExpires = undefined
    await user.save()

    logActivity({ type:'password_reset_completed', user, ip: req.ip, message:`Password reset completed for ${user.email}` })
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
