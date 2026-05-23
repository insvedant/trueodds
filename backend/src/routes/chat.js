/**
 * chat.js — REST endpoints for chat history + conversation management
 * Real-time messaging is handled by socket.io in chatSocket.js
 */
const router = require('express').Router()
const { protect, requireAdmin } = require('../middleware/auth')
const ChatConversation = require('../models/ChatConversation')
const ChatMessage      = require('../models/ChatMessage')
const User             = require('../models/User')
const { notifyNewChatMessage, notifyNewConversation } = require('../services/telegramService')

// ── POST /api/chat/send ───────────────────────────────────────────────────
router.post('/send', protect, async (req, res) => {
  try {
    const { text, conversationId } = req.body
    if (!text?.trim()) return res.status(400).json({ success: false, message: 'Message text required.' })

    const isNewConvo = !conversationId

    let convo = conversationId
      ? await ChatConversation.findById(conversationId)
      : await ChatConversation.findOne({ user: req.user._id, status: { $ne: 'resolved' } })

    if (!convo) convo = await ChatConversation.create({ user: req.user._id })

    const msg = await ChatMessage.create({
      conversation: convo._id,
      sender:   'user',
      senderId: req.user._id,
      text:     text.trim().slice(0, 2000),
    })

    await ChatConversation.findByIdAndUpdate(convo._id, {
      lastMessage:   text.trim().slice(0, 100),
      lastMessageAt: new Date(),
      $inc:          { unreadAdmin: 1 },
    })

    const sender = req.user
    if (isNewConvo) {
      notifyNewConversation({
        userName:  sender.name,
        userEmail: sender.email,
        userPlan:  sender.plan,
      }).catch(() => {})
    } else {
      notifyNewChatMessage({
        userName:       sender.name,
        userEmail:      sender.email,
        userPlan:       sender.plan,
        messageText:    text.trim(),
        conversationId: convo._id,
      }).catch(() => {})
    }

    res.json({ success: true, message: msg, conversation: convo, conversationId: convo._id })
  } catch (err) {
    res.status(500).json({ success: false, message: err.message })
  }
})

// ── GET /api/chat/my-conversation ────────────────────────────────────────
router.get('/my-conversation', protect, async (req, res) => {
  try {
    let convo = await ChatConversation.findOne({ user: req.user._id, status: { $ne: 'resolved' } })
      .sort({ createdAt: -1 })

    if (!convo) {
      convo = await ChatConversation.create({ user: req.user._id })
    }

    const messages = await ChatMessage.find({ conversation: convo._id })
      .sort({ createdAt: 1 }).limit(100)

    await ChatConversation.findByIdAndUpdate(convo._id, { unreadUser: 0 })

    res.json({ success: true, conversation: convo, messages })
  } catch (err) {
    res.status(500).json({ success: false, message: err.message })
  }
})

// ── GET /api/chat/unread ──────────────────────────────────────────────────
router.get('/unread', protect, async (req, res) => {
  try {
    const convo = await ChatConversation.findOne({ user: req.user._id, status: { $ne: 'resolved' } })
    res.json({ success: true, unread: convo?.unreadUser || 0 })
  } catch {
    res.json({ success: true, unread: 0 })
  }
})

// ── POST /api/chat/admin/send ─────────────────────────────────────────────
router.post('/admin/send', protect, requireAdmin, async (req, res) => {
  try {
    const { text, conversationId } = req.body
    if (!text?.trim())   return res.status(400).json({ success: false, message: 'Message text required.' })
    if (!conversationId) return res.status(400).json({ success: false, message: 'conversationId required.' })

    const convo = await ChatConversation.findById(conversationId)
    if (!convo) return res.status(404).json({ success: false, message: 'Conversation not found.' })

    const msg = await ChatMessage.create({
      conversation: convo._id,
      sender:       'admin',
      senderId:     req.user._id,
      text:         text.trim().slice(0, 2000),
    })

    await ChatConversation.findByIdAndUpdate(convo._id, {
      lastMessage:   text.trim().slice(0, 100),
      lastMessageAt: new Date(),
      status:        'active',
      $inc:          { unreadUser: 1 },
    })

    res.json({ success: true, message: msg })
  } catch (err) {
    res.status(500).json({ success: false, message: err.message })
  }
})

// ── GET /api/chat/admin/conversations ─────────────────────────────────────
router.get('/admin/conversations', protect, requireAdmin, async (req, res) => {
  try {
    const status = req.query.status || 'all'
    const filter = status === 'all' ? {} : { status }

    const convos = await ChatConversation.find(filter)
      .populate('user', 'name email plan subscriptionStatus')
      .sort({ lastMessageAt: -1 })
      .limit(100)

    res.json({ success: true, conversations: convos })
  } catch (err) {
    res.status(500).json({ success: false, message: err.message })
  }
})

// ── GET /api/chat/admin/conversations/:id ─────────────────────────────────
router.get('/admin/conversations/:id', protect, requireAdmin, async (req, res) => {
  try {
    const convo = await ChatConversation.findById(req.params.id)
      .populate('user', 'name email plan subscriptionStatus createdAt')

    if (!convo) return res.status(404).json({ success: false, message: 'Conversation not found.' })

    const messages = await ChatMessage.find({ conversation: convo._id })
      .sort({ createdAt: 1 }).limit(200)

    await ChatConversation.findByIdAndUpdate(convo._id, { unreadAdmin: 0 })

    res.json({ success: true, conversation: convo, messages })
  } catch (err) {
    res.status(500).json({ success: false, message: err.message })
  }
})

// ── PATCH /api/chat/admin/conversations/:id/status ────────────────────────
router.patch('/admin/conversations/:id/status', protect, requireAdmin, async (req, res) => {
  try {
    const { status } = req.body
    if (!['open','active','resolved'].includes(status))
      return res.status(400).json({ success: false, message: 'Invalid status.' })

    const convo = await ChatConversation.findByIdAndUpdate(req.params.id, { status }, { new: true })
    res.json({ success: true, conversation: convo })
  } catch (err) {
    res.status(500).json({ success: false, message: err.message })
  }
})

// ── GET /api/chat/admin/unread ─────────────────────────────────────────────
router.get('/admin/unread', protect, requireAdmin, async (req, res) => {
  try {
    const result = await ChatConversation.aggregate([
      { $group: { _id: null, total: { $sum: '$unreadAdmin' } } }
    ])
    res.json({ success: true, unread: result[0]?.total || 0 })
  } catch {
    res.json({ success: true, unread: 0 })
  }
})

module.exports = router
