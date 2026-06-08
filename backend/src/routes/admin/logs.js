/**
 * TrueOdds — Admin Activity Logs API
 * GET /api/admin/logs
 */
const router       = require('express').Router()
const ActivityLog  = require('../../models/ActivityLog')
const { protect, adminOnly } = require('../../middleware/auth')

router.use(protect, adminOnly)

// GET /api/admin/logs
router.get('/', async (req, res) => {
  try {
    const {
      page     = 1,
      limit    = 50,
      type,
      category,
      status,
      email,
      search,
      from,
      to,
    } = req.query

    const filter = {}
    if (type)     filter.type     = type
    if (category) filter.category = category
    if (status)   filter.status   = status
    if (email)    filter.email    = { $regex: email, $options: 'i' }
    if (search)   filter.$or      = [
      { email:   { $regex: search, $options: 'i' } },
      { message: { $regex: search, $options: 'i' } },
      { name:    { $regex: search, $options: 'i' } },
    ]
    if (from || to) {
      filter.createdAt = {}
      if (from) filter.createdAt.$gte = new Date(from)
      if (to)   filter.createdAt.$lte = new Date(to)
    }

    const skip  = (parseInt(page) - 1) * parseInt(limit)
    const total = await ActivityLog.countDocuments(filter)
    const logs  = await ActivityLog.find(filter)
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(parseInt(limit))
      .lean()

    // Aggregate counts by category for the stats bar
    const categoryCounts = await ActivityLog.aggregate([
      { $match: filter },
      { $group: { _id: '$category', count: { $sum: 1 } } },
    ])

    const typeCounts = await ActivityLog.aggregate([
      { $match: { ...filter, status: 'failed' } },
      { $group: { _id: '$type', count: { $sum: 1 } } },
      { $sort: { count: -1 } },
      { $limit: 5 },
    ])

    res.json({
      success: true,
      logs,
      total,
      page:       parseInt(page),
      totalPages: Math.ceil(total / parseInt(limit)),
      stats: {
        categories: Object.fromEntries(categoryCounts.map(c => [c._id, c.count])),
        topFailures: typeCounts,
      },
    })
  } catch (err) {
    res.status(500).json({ success: false, message: err.message })
  }
})

// DELETE /api/admin/logs — clear all logs (admin only)
router.delete('/', async (req, res) => {
  try {
    const result = await ActivityLog.deleteMany({})
    res.json({ success: true, deleted: result.deletedCount })
  } catch (err) {
    res.status(500).json({ success: false, message: err.message })
  }
})

module.exports = router
