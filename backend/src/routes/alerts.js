/**
 * alerts.js — Real alerts from arb and +EV detection
 * Alerts are generated when the odds service finds opportunities
 * and stored in MongoDB. No hardcoded data.
 */

const router   = require('express').Router()
const { protect, requirePlan, adminOnly } = require('../middleware/auth')
const mongoose = require('mongoose')
const { runAlertScheduler } = require('../services/alertScheduler')

// Simple Alert schema (inline — no separate model file needed)
const alertSchema = new mongoose.Schema({
  user:      { type: mongoose.Schema.Types.ObjectId, ref: 'User', index: true },
  type:      { type: String, enum: ['arb','ev','line','sharp','system'], default: 'system' },
  title:     { type: String, required: true },
  message:   { type: String, required: true },
  value:     String,   // e.g. "+3.2%"
  sport:     String,
  eventId:   String,
  read:      { type: Boolean, default: false },
  createdAt: { type: Date, default: Date.now, expires: 7 * 24 * 60 * 60 }, // auto-delete after 7 days
})

const Alert = mongoose.models.Alert || mongoose.model('Alert', alertSchema)

// ── GET /api/alerts ───────────────────────────────────────────────────────
router.get('/', protect, requirePlan('basic', 'gold', 'platinum'), async (req, res) => {
  try {
    const { limit = 50 } = req.query
    const alerts = await Alert.find({ user: req.user._id })
      .sort({ createdAt: -1 })
      .limit(parseInt(limit))
      .lean()

    const unread = await Alert.countDocuments({ user: req.user._id, read: false })

    res.json({ success: true, alerts, unread, total: alerts.length })
  } catch (e) {
    res.status(500).json({ success: false, message: e.message })
  }
})

// ── PATCH /api/alerts/:id/read ────────────────────────────────────────────
router.patch('/:id/read', protect, async (req, res) => {
  try {
    await Alert.updateOne({ _id: req.params.id, user: req.user._id }, { read: true })
    res.json({ success: true })
  } catch (e) {
    res.status(500).json({ success: false, message: e.message })
  }
})

// ── PATCH /api/alerts/read-all ────────────────────────────────────────────
router.patch('/read-all', protect, async (req, res) => {
  try {
    await Alert.updateMany({ user: req.user._id, read: false }, { read: true })
    res.json({ success: true })
  } catch (e) {
    res.status(500).json({ success: false, message: e.message })
  }
})

// ── DELETE /api/alerts/:id ────────────────────────────────────────────────
router.delete('/:id', protect, async (req, res) => {
  try {
    await Alert.deleteOne({ _id: req.params.id, user: req.user._id })
    res.json({ success: true })
  } catch (e) {
    res.status(500).json({ success: false, message: e.message })
  }
})

// ── Internal: create alert (called by odds service) ───────────────────────
// POST /api/alerts/create (internal use, no auth — called from apiService)
router.post('/create', async (req, res) => {
  try {
    const { userId, type, title, message, value, sport, eventId } = req.body
    if (!userId || !title || !message) {
      return res.status(400).json({ success: false, message: 'userId, title, message required' })
    }
    const alert = await Alert.create({ user: userId, type, title, message, value, sport, eventId })
    res.json({ success: true, alert })
  } catch (e) {
    res.status(500).json({ success: false, message: e.message })
  }
})

// ── PUT /api/alerts/prefs ─────────────────────────────────────────────────
// Update alert preferences
router.put('/prefs', protect, requirePlan('basic', 'gold', 'platinum'), async (req, res) => {
  try {
    const { emailAlerts, arbThreshold, evThreshold, sports, hotDealsOnly } = req.body
    const plan = req.user.plan

    // Basic plan: enforce 2% minimum — not negotiable
    let arbMin = plan === 'basic' ? 2.0 : 1.0
    let evMin  = plan === 'basic' ? 3.0 : 1.0

    const update = {}
    if (emailAlerts  !== undefined) update['alertPrefs.emailAlerts']  = emailAlerts
    if (hotDealsOnly !== undefined) update['alertPrefs.hotDealsOnly'] = hotDealsOnly
    if (Array.isArray(sports))      update['alertPrefs.sports']       = sports

    // Only allow threshold changes for gold/platinum
    if (['gold','platinum'].includes(plan)) {
      if (arbThreshold !== undefined) update['alertPrefs.arbThreshold'] = Math.max(arbMin, parseFloat(arbThreshold))
      if (evThreshold  !== undefined) update['alertPrefs.evThreshold']  = Math.max(evMin,  parseFloat(evThreshold))
    }

    const User = require('../models/User')
    await User.updateOne({ _id: req.user._id }, { $set: update })
    res.json({ success: true, message: 'Alert preferences updated.' })
  } catch (e) {
    res.status(500).json({ success: false, message: e.message })
  }
})

// ── POST /api/alerts/run-scheduler ───────────────────────────────────────
// Admin trigger to manually run the alert scheduler
router.post('/run-scheduler', protect, adminOnly, async (req, res) => {
  try {
    res.json({ success: true, message: 'Scheduler started — check server logs.' })
    // Run async after responding so request doesn't time out
    runAlertScheduler().catch(err => console.error('[Scheduler]', err.message))
  } catch (e) {
    res.status(500).json({ success: false, message: e.message })
  }
})

module.exports = router
module.exports.Alert = Alert
