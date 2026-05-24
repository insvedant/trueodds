/**
 * telegramService.js
 * ─────────────────────────────────────────────────────────────────────────
 * Two-way Telegram chat integration.
 *
 * HOW IT WORKS:
 *  1. User sends chat message on site
 *  2. Backend sends Telegram notification with "Reply in Telegram" button
 *  3. You reply to that message in Telegram
 *  4. Telegram sends webhook to POST /api/telegram/webhook
 *  5. Backend saves your reply as admin message in MongoDB
 *  6. User sees reply within 4 seconds via polling
 *
 * ONE-TIME SETUP:
 *  1. Set TELEGRAM_BOT_TOKEN and TELEGRAM_CHAT_ID in Render env vars (already done)
 *  2. Register webhook — visit this URL once in your browser (replace token):
 *     https://api.telegram.org/bot<TOKEN>/setWebhook?url=https://trueodds.onrender.com/api/telegram/webhook
 *  3. That's it — replies in Telegram now go directly to users
 */

const https = require('https')

const BOT_TOKEN    = process.env.TELEGRAM_BOT_TOKEN
const CHAT_ID      = process.env.TELEGRAM_CHAT_ID
const BACKEND_URL  = process.env.BACKEND_URL || 'https://trueodds.onrender.com'

function isConfigured() {
  return BOT_TOKEN && CHAT_ID &&
    !String(BOT_TOKEN).includes('REPLACE') &&
    !String(CHAT_ID).includes('REPLACE')
}

// ── Core send function ────────────────────────────────────────────────────
function sendTelegramRaw(payload) {
  return new Promise((resolve) => {
    if (!isConfigured()) {
      console.log('[Telegram] Not configured')
      return resolve(null)
    }

    const body = JSON.stringify(payload)
    const req  = https.request({
      hostname: 'api.telegram.org',
      path:     `/bot${BOT_TOKEN}/sendMessage`,
      method:   'POST',
      headers:  { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(body) },
    }, res => {
      let data = ''
      res.on('data', c => data += c)
      res.on('end', () => {
        try { resolve(JSON.parse(data)) } catch { resolve(null) }
      })
    })
    req.on('error', err => { console.warn('[Telegram] Error:', err.message); resolve(null) })
    req.write(body)
    req.end()
  })
}

// ── Notify admin of new user message ─────────────────────────────────────
// Stores conversationId in the message so replies can be matched back
async function notifyNewChatMessage({ userName, userEmail, userPlan, messageText, conversationId }) {
  const planEmoji = { free:'⚪', basic:'🟢', gold:'🟡', platinum:'🟣' }[userPlan] || '⚪'
  const preview   = messageText.length > 200 ? messageText.slice(0, 200) + '…' : messageText

  const text = [
    `💬 <b>New chat message</b>`,
    ``,
    `<b>From:</b> ${userName} (${userEmail})`,
    `<b>Plan:</b> ${planEmoji} ${userPlan}`,
    `<b>ConvID:</b> <code>${conversationId}</code>`,
    ``,
    `<b>Message:</b>`,
    preview,
    ``,
    `<i>↩️ Reply to this message in Telegram to respond to the user</i>`,
  ].join('\n')

  return sendTelegramRaw({
    chat_id:    CHAT_ID,
    text,
    parse_mode: 'HTML',
    reply_markup: JSON.stringify({
      inline_keyboard: [[{
        text: '💬 Open Admin Chat',
        url:  `${process.env.FRONTEND_URL || 'https://trueodds.ca'}/admin/chat`,
      }]]
    })
  })
}

// ── Notify admin of new conversation ─────────────────────────────────────
async function notifyNewConversation({ userName, userEmail, userPlan, conversationId }) {
  const text = [
    `🆕 <b>New support conversation started</b>`,
    ``,
    `<b>User:</b> ${userName}`,
    `<b>Email:</b> ${userEmail}`,
    `<b>Plan:</b> ${userPlan}`,
    `<b>ConvID:</b> <code>${conversationId}</code>`,
    ``,
    `<i>↩️ Reply to this message in Telegram to respond</i>`,
  ].join('\n')

  return sendTelegramRaw({
    chat_id:    CHAT_ID,
    text,
    parse_mode: 'HTML',
    reply_markup: JSON.stringify({
      inline_keyboard: [[{
        text: '💬 Open Admin Chat',
        url:  `${process.env.FRONTEND_URL || 'https://trueodds.ca'}/admin/chat`,
      }]]
    })
  })
}

// ── Send reply confirmation back to Telegram ─────────────────────────────
async function confirmReply(userName) {
  return sendTelegramRaw({
    chat_id:    CHAT_ID,
    text:       `✅ Reply sent to ${userName}`,
    parse_mode: 'HTML',
  })
}

// ── Register webhook with Telegram ───────────────────────────────────────
// Call this once to tell Telegram where to send updates
async function registerWebhook() {
  if (!isConfigured()) return
  const webhookUrl = `${BACKEND_URL}/api/telegram/webhook`
  return new Promise((resolve) => {
    const body = JSON.stringify({ url: webhookUrl, allowed_updates: ['message'] })
    const req  = https.request({
      hostname: 'api.telegram.org',
      path:     `/bot${BOT_TOKEN}/setWebhook`,
      method:   'POST',
      headers:  { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(body) },
    }, res => {
      let data = ''
      res.on('data', c => data += c)
      res.on('end', () => {
        try {
          const r = JSON.parse(data)
          console.log('[Telegram] Webhook registered:', r.description || r.ok)
          resolve(r)
        } catch { resolve(null) }
      })
    })
    req.on('error', err => { console.warn('[Telegram] Webhook reg error:', err.message); resolve(null) })
    req.write(body)
    req.end()
  })
}

module.exports = {
  notifyNewChatMessage,
  notifyNewConversation,
  confirmReply,
  registerWebhook,
  isConfigured,
}
