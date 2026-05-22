/**
 * ml.js — ML predictions route
 * Reads predictions from MongoDB (written by Python ML service)
 * Also proxies requests to FastAPI ML server for real-time predictions
 */

const router   = require('express').Router()
const { protect, requirePlan } = require('../middleware/auth')
const mongoose = require('mongoose')

const ML_API = process.env.ML_API_URL || 'http://localhost:8000'

async function mlFetch(path, options = {}) {
  try {
    const res = await fetch(`${ML_API}${path}`, {
      ...options,
      headers: { 'Content-Type': 'application/json', ...options.headers },
      signal: AbortSignal.timeout(5000),
    })
    if (!res.ok) throw new Error(`ML API error: ${res.status}`)
    return await res.json()
  } catch (err) {
    return { available: false, reason: err.message, offline: true }
  }
}

// ── GET /api/ml/health ────────────────────────────────────────────────────
router.get('/health', async (req, res) => {
  const health = await mlFetch('/health')
  const db     = mongoose.connection.db

  const snapshots   = await db.collection('odds_snapshots').countDocuments()
  const predictions = await db.collection('ml_predictions').countDocuments()
  const lineMovs    = await db.collection('line_movements').countDocuments()
  const arbHistory  = await db.collection('arb_history').countDocuments()

  res.json({
    success: true,
    ml_service: health.offline ? 'offline' : 'online',
    data_pipeline: {
      odds_snapshots:  snapshots,
      predictions:     predictions,
      line_movements:  lineMovs,
      arb_history:     arbHistory,
      ready_for_ml:    snapshots >= 500,
      status:          snapshots < 100  ? 'collecting'
                     : snapshots < 500  ? 'building'
                     : 'ready',
    },
    ml_health: health,
  })
})

// ── GET /api/ml/predictions/batch ────────────────────────────────────────
router.get('/predictions/batch', protect, async (req, res) => {
  try {
    const db   = mongoose.connection.db
    const now  = new Date()
    const ago  = new Date(now - 48 * 60 * 60 * 1000)

    const predictions = await db.collection('ml_predictions')
      .find({ generated_at: { $gte: ago.toISOString() } }, { projection: { _id: 0 } })
      .sort({ generated_at: -1 })
      .limit(20)
      .toArray()

    const final = predictions.length > 0 ? predictions :
      await db.collection('ml_predictions')
        .find({}, { projection: { _id: 0 } })
        .sort({ generated_at: -1 })
        .limit(20)
        .toArray()

    res.json({ success: true, count: final.length, predictions: final })
  } catch (err) {
    res.status(500).json({ success: false, message: err.message })
  }
})

// ── GET /api/ml/predictions/:eventId ─────────────────────────────────────
router.get('/predictions/:eventId', protect, async (req, res) => {
  try {
    const db   = mongoose.connection.db
    const pred = await db.collection('ml_predictions').findOne(
      { event_id: req.params.eventId },
      { projection: { _id: 0 } }
    )

    if (pred) {
      return res.json({ success: true, source: 'cache', prediction: pred })
    }

    const live = await mlFetch(`/predictions/${req.params.eventId}`)
    res.json({ success: true, source: 'live', prediction: live })
  } catch (err) {
    res.status(500).json({ success: false, message: err.message })
  }
})

// ── GET /api/ml/sharp-money ───────────────────────────────────────────────
router.get('/sharp-money', protect, requirePlan('gold', 'platinum'), async (req, res) => {
  try {
    const data = await mlFetch('/sharp-money')
    res.json({ success: true, ...data })
  } catch (err) {
    res.status(500).json({ success: false, message: err.message })
  }
})

// ── GET /api/ml/arb-windows ───────────────────────────────────────────────
router.get('/arb-windows', protect, async (req, res) => {
  try {
    const data = await mlFetch('/arb-windows')
    res.json({ success: true, ...data })
  } catch (err) {
    res.status(500).json({ success: false, message: err.message })
  }
})

// ── POST /api/ml/score-ev ─────────────────────────────────────────────────
router.post('/score-ev', protect, requirePlan('platinum'), async (req, res) => {
  try {
    const data = await mlFetch('/predict/ev', {
      method: 'POST',
      body:   JSON.stringify(req.body),
    })
    res.json({ success: true, ...data })
  } catch (err) {
    res.status(500).json({ success: false, message: err.message })
  }
})

// ── GET /api/ml/insights ──────────────────────────────────────────────────
router.get('/insights', protect, async (req, res) => {
  try {
    const data = await mlFetch(`/insights/${req.user._id}`)
    res.json({ success: true, ...data })
  } catch (err) {
    res.status(500).json({ success: false, message: err.message })
  }
})

// ── GET /api/ml/dashboard ─────────────────────────────────────────────────
router.get('/dashboard', protect, async (req, res) => {
  if (req.user.role !== 'admin') {
    return res.status(403).json({ success: false, message: 'Admin only' })
  }

  const db = mongoose.connection.db
  const now = new Date()
  const oneDayAgo = new Date(now - 24 * 60 * 60 * 1000)

  const [snapshots, predictions, movements, arbs, trainingLog] = await Promise.all([
    db.collection('odds_snapshots').countDocuments(),
    db.collection('ml_predictions').countDocuments(),
    db.collection('line_movements').countDocuments(),
    db.collection('arb_history').countDocuments(),
    db.collection('ml_training_log').find({}, { sort: { trained_at: -1 }, limit: 5 }).toArray(),
  ])

  const snapshotsToday = await db.collection('odds_snapshots').countDocuments({
    fetched_at: { $gte: oneDayAgo },
  })

  res.json({
    success: true,
    pipeline: {
      total_snapshots:    snapshots,
      snapshots_today:    snapshotsToday,
      total_predictions:  predictions,
      line_movements:     movements,
      arb_history:        arbs,
      ml_ready:           snapshots >= 500,
      data_status:        snapshots < 100  ? '🟡 Collecting data'
                        : snapshots < 500  ? '🟠 Building dataset'
                        : '🟢 ML Active',
    },
    recent_training: trainingLog.map(t => ({
      trained_at: t.trained_at,
      results:    t.results,
    })),
  })
})

module.exports = router
