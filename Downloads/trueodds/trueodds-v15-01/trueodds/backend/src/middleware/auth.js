const jwt = require('jsonwebtoken')
const User = require('../models/User')

const protect = async (req, res, next) => {
  try {
    const auth = req.headers.authorization
    if (!auth?.startsWith('Bearer ')) return res.status(401).json({ success: false, message: 'Not authenticated.' })
    const decoded = jwt.verify(auth.split(' ')[1], process.env.JWT_SECRET)
    const user = await User.findById(decoded.id)
    if (!user || !user.isActive) return res.status(401).json({ success: false, message: 'User not found.' })
    req.user = user; next()
  } catch { res.status(401).json({ success: false, message: 'Invalid token.' }) }
}

const adminOnly = (req, res, next) => {
  if (req.user?.role !== 'admin') return res.status(403).json({ success: false, message: 'Admin only.' })
  next()
}

const requirePlan = (...plans) => (req, res, next) => {
  if (!req.user) return res.status(401).json({ success: false, message: 'Not authenticated.' })
  if (!plans.includes(req.user.plan)) return res.status(403).json({ success: false, message: `Requires ${plans.join(' or ')} plan.`, upgradeRequired: true })
  next()
}

const optionalAuth = async (req, res, next) => {
  try {
    const auth = req.headers.authorization
    if (auth?.startsWith('Bearer ')) {
      const decoded = jwt.verify(auth.split(' ')[1], process.env.JWT_SECRET)
      req.user = await User.findById(decoded.id)
    }
  } catch {}
  next()
}

module.exports = { protect, adminOnly, requirePlan, optionalAuth }
