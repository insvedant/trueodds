

const router   = require('express').Router()
const { protect, requirePlan, adminOnly } = require('../middleware/auth')
const mongoose = require('mongoose')
const { runAlertScheduler } = require('../services/alertScheduler')



const Alert = require('../models/Alert')

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

router.patch('/:id/read', protect, async (req, res) => {
  try {
    await Alert.updateOne({ _id: req.params.id, user: req.user._id }, { read: true })
    res.json({ success: true })
  } catch (e) {
    res.status(500).json({ success: false, message: e.message })
  }
})

router.patch('/read-all', protect, async (req, res) => {
  try {
    await Alert.updateMany({ user: req.user._id, read: false }, { read: true })
    res.json({ success: true })
  } catch (e) {
    res.status(500).json({ success: false, message: e.message })
  }
})

router.delete('/:id', protect, async (req, res) => {
  try {
    await Alert.deleteOne({ _id: req.params.id, user: req.user._id })
    res.json({ success: true })
  } catch (e) {
    res.status(500).json({ success: false, message: e.message })
  }
})

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

router.put('/prefs', protect, requirePlan('basic', 'gold', 'platinum'), async (req, res) => {
  try {
    const { emailAlerts, arbThreshold, evThreshold, sports, hotDealsOnly } = req.body
    const plan = req.user.plan

    
    let arbMin = plan === 'basic' ? 2.0 : 1.0
    let evMin  = plan === 'basic' ? 3.0 : 1.0

    const update = {}
    if (emailAlerts  !== undefined) update['alertPrefs.emailAlerts']  = emailAlerts
    if (hotDealsOnly !== undefined) update['alertPrefs.hotDealsOnly'] = hotDealsOnly
    if (Array.isArray(sports))      update['alertPrefs.sports']       = sports

    
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

router.post('/run-scheduler', protect, adminOnly, async (req, res) => {
  try {
    res.json({ success: true, message: 'Scheduler started — check server logs.' })
    
    runAlertScheduler().catch(err => console.error('[Scheduler]', err.message))
  } catch (e) {
    res.status(500).json({ success: false, message: e.message })
  }
})

module.exports = router
