/**
 * telegram.js — Webhook receiver for Telegram bot replies
 *
 * POST /api/telegram/webhook
 * Called by Telegram when you reply to a notification in the bot chat.
 * Parses the reply, finds the conversation, saves as admin message.
 */

const router           = require('express').Router()
const ChatConversation = require('../models/ChatConversation')
const ChatMessage      = require('../models/ChatMessage')
const User             = require('../models/User')
const { confirmReply } = require('../services/telegramService')

// ── POST /api/telegram/webhook ────────────────────────────────────────────
router.post('/webhook', async (req, res) => {
  // Always respond 200 immediately — Telegram will retry if we don't
  res.sendStatus(200)

  try {
    const update = req.body
    const msg    = update?.message

    // Only handle text replies from the admin chat
    if (!msg?.text || !msg?.reply_to_message) return

    const adminChatId = String(process.env.TELEGRAM_CHAT_ID)
    const fromId      = String(msg.from?.id)

    // Security: only accept messages from the configured admin chat
    if (fromId !== adminChatId && String(msg.chat?.id) !== adminChatId) {
      console.log('[Telegram Webhook] Ignored message from unknown chat:', fromId)
      return
    }

    const replyText    = msg.text.trim()
    const originalText = msg.reply_to_message?.text || ''

    // Skip bot commands
    if (replyText.startsWith('/')) return

    // Extract conversationId from original notification text
    // Format: "ConvID: <code>XXXXX</code>" or "ConvID: XXXXX"
    const convIdMatch = originalText.match(/ConvID[:\s]+([a-f0-9]{24})/i)
    if (!convIdMatch) {
      console.log('[Telegram Webhook] No conversationId found in replied message')
      return
    }

    const conversationId = convIdMatch[1]
    const convo = await ChatConversation.findById(conversationId)
      .populate('user', 'name email')

    if (!convo) {
      console.log('[Telegram Webhook] Conversation not found:', conversationId)
      return
    }

    // Find any admin user to use as senderId
    const adminUser = await User.findOne({ role: 'admin' })
    if (!adminUser) return

    // Save admin reply as chat message
    await ChatMessage.create({
      conversation: convo._id,
      sender:       'admin',
      senderId:     adminUser._id,
      text:         replyText,
    })

    // Update conversation
    await ChatConversation.findByIdAndUpdate(convo._id, {
      lastMessage:   replyText.slice(0, 100),
      lastMessageAt: new Date(),
      status:        'active',
      $inc:          { unreadUser: 1 },
    })

    console.log(`[Telegram Webhook] Reply saved for conversation ${conversationId}: "${replyText.slice(0, 50)}"`)

    // Confirm to admin in Telegram
    await confirmReply(convo.user?.name || 'user')

  } catch (err) {
    console.error('[Telegram Webhook] Error:', err.message)
  }
})

module.exports = router
