/**
 * chatSocket.js — Socket.io real-time chat handler
 * Handles: joining rooms, sending messages, typing indicators, read receipts
 */
const jwt              = require('jsonwebtoken')
const User             = require('../models/User')
const ChatConversation = require('../models/ChatConversation')
const ChatMessage      = require('../models/ChatMessage')

// Map of userId -> socketId for targeted delivery
const userSockets  = new Map()
const adminSockets = new Set()

module.exports = function initChatSocket(io) {

  // ── Auth middleware for socket connections ──────────────────────────────
  io.use(async (socket, next) => {
    try {
      const token = socket.handshake.auth?.token
      if (!token) return next(new Error('No token'))
      const decoded = jwt.verify(token, process.env.JWT_SECRET)
      const user    = await User.findById(decoded.id).select('name email plan role')
      if (!user) return next(new Error('Invalid token'))
      socket.user = user
      next()
    } catch {
      next(new Error('Auth failed'))
    }
  })

  io.on('connection', async (socket) => {
    const user    = socket.user
    const isAdmin = user.role === 'admin'

    console.log(`[Chat] ${isAdmin ? 'Admin' : 'User'} connected: ${user.name} (${socket.id})`)

    // ── Track socket ───────────────────────────────────────────────────────
    if (isAdmin) {
      adminSockets.add(socket.id)
      socket.join('admin_room')
    } else {
      userSockets.set(user._id.toString(), socket.id)
      // Auto-join their conversation room
      const convo = await ChatConversation.findOne({ user: user._id, status: { $ne: 'resolved' } })
        .sort({ createdAt: -1 })
      if (convo) socket.join(`convo_${convo._id}`)
    }

    // ── User sends a message ───────────────────────────────────────────────
    socket.on('user_message', async ({ text, conversationId }) => {
      try {
        if (!text?.trim() || isAdmin) return

        // Get or create conversation
        let convo = conversationId
          ? await ChatConversation.findById(conversationId)
          : await ChatConversation.findOne({ user: user._id, status: { $ne: 'resolved' } })

        if (!convo) convo = await ChatConversation.create({ user: user._id })

        socket.join(`convo_${convo._id}`)

        const msg = await ChatMessage.create({
          conversation: convo._id,
          sender:   'user',
          senderId: user._id,
          text:     text.trim().slice(0, 2000),
        })

        // Update conversation
        await ChatConversation.findByIdAndUpdate(convo._id, {
          lastMessage:   text.trim().slice(0, 100),
          lastMessageAt: new Date(),
          status:        convo.status === 'resolved' ? 'open' : convo.status,
          $inc:          { unreadAdmin: 1 },
        })

        const payload = {
          _id:            msg._id,
          conversationId: convo._id,
          sender:         'user',
          senderName:     user.name,
          senderPlan:     user.plan,
          text:           msg.text,
          createdAt:      msg.createdAt,
        }

        // Send to user's room
        io.to(`convo_${convo._id}`).emit('new_message', payload)
        // Notify all admins
        io.to('admin_room').emit('new_message', { ...payload, userId: user._id })
        io.to('admin_room').emit('conversation_updated', { conversationId: convo._id, unreadAdmin: 1 })

      } catch (err) {
        socket.emit('error', { message: 'Failed to send message.' })
        console.error('[Chat] user_message error:', err.message)
      }
    })

    // ── Admin sends a message ──────────────────────────────────────────────
    socket.on('admin_message', async ({ text, conversationId }) => {
      try {
        if (!text?.trim() || !isAdmin || !conversationId) return

        const convo = await ChatConversation.findById(conversationId).populate('user', 'name')
        if (!convo) return

        const msg = await ChatMessage.create({
          conversation: convo._id,
          sender:   'admin',
          senderId: user._id,
          text:     text.trim().slice(0, 2000),
        })

        await ChatConversation.findByIdAndUpdate(convo._id, {
          lastMessage:   text.trim().slice(0, 100),
          lastMessageAt: new Date(),
          status:        'active',
          $inc:          { unreadUser: 1 },
        })

        const payload = {
          _id:            msg._id,
          conversationId: convo._id,
          sender:         'admin',
          senderName:     'TrueOdds Support',
          text:           msg.text,
          createdAt:      msg.createdAt,
        }

        // Send to user's room + all admins
        io.to(`convo_${convo._id}`).emit('new_message', payload)
        io.to('admin_room').emit('new_message', payload)

        // Also push to user's socket directly if they're connected
        const userSocketId = userSockets.get(convo.user._id.toString())
        if (userSocketId) io.to(userSocketId).emit('new_message', payload)

      } catch (err) {
        socket.emit('error', { message: 'Failed to send message.' })
        console.error('[Chat] admin_message error:', err.message)
      }
    })

    // ── Admin joins a conversation room ────────────────────────────────────
    socket.on('admin_join_conversation', ({ conversationId }) => {
      if (!isAdmin || !conversationId) return
      socket.join(`convo_${conversationId}`)
    })

    // ── Typing indicators ──────────────────────────────────────────────────
    socket.on('typing_start', ({ conversationId }) => {
      if (!conversationId) return
      socket.to(`convo_${conversationId}`).emit('typing', {
        conversationId,
        sender:     isAdmin ? 'admin' : 'user',
        senderName: isAdmin ? 'Support' : user.name,
        typing:     true,
      })
      if (isAdmin) {
        const convoUsers = [...userSockets.entries()]
        // handled by room broadcast above
      }
    })

    socket.on('typing_stop', ({ conversationId }) => {
      if (!conversationId) return
      socket.to(`convo_${conversationId}`).emit('typing', {
        conversationId,
        sender:  isAdmin ? 'admin' : 'user',
        typing:  false,
      })
    })

    // ── Disconnect ─────────────────────────────────────────────────────────
    socket.on('disconnect', () => {
      if (isAdmin) adminSockets.delete(socket.id)
      else userSockets.delete(user._id.toString())
      console.log(`[Chat] Disconnected: ${user.name}`)
    })
  })
}
