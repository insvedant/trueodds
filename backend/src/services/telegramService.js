/**
 * telegramService.js
 * ─────────────────────────────────────────────────────────────────────────
 * Sends Telegram notifications to the admin when a user sends a chat message.
 *
 * ONE-TIME SETUP (5 minutes):
 *  1. Open Telegram, search for @BotFather
 *  2. Send /newbot — give it a name e.g. "TrueOdds Admin"
 *  3. BotFather gives you a token like: 7123456789:AAF...
 *  4. Search for your new bot in Telegram and send it /start
 *  5. Visit: https://api.telegram.org/bot<YOUR_TOKEN>/getUpdates
 *     Find your chat_id in the response (a number like 123456789)
 *  6. Add to Render environment variables:
 *       TELEGRAM_BOT_TOKEN=7123456789:AAF...
 *       TELEGRAM_CHAT_ID=123456789
 *
 * That's it. You'll get a Telegram message every time a user chats.
 */

const https = require('https')

const BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN
const CHAT_ID   = process.env.TELEGRAM_CHAT_ID

function isConfigured() {
  return BOT_TOKEN && CHAT_ID &&
    !BOT_TOKEN.includes('REPLACE') &&
    !CHAT_ID.includes('REPLACE')
}

/**
 * Send a plain text message via Telegram Bot API
 */
function sendTelegram(text) {
  return new Promise((resolve, reject) => {
    if (!isConfigured()) {
      console.log('[Telegram] Not configured — would have sent:', text.slice(0, 80))
      return resolve(null)
    }

    const body = JSON.stringify({
      chat_id:    CHAT_ID,
      text,
      parse_mode: 'HTML',
      // Inline keyboard with link to admin chat
      reply_markup: JSON.stringify({
        inline_keyboard: [[{
          text: '💬 Open Admin Chat',
          url:  process.env.FRONTEND_URL
            ? `${process.env.FRONTEND_URL}/admin/chat`
            : 'https://trueodds.ca/admin/chat',
        }]]
      })
    })

    const req = https.request({
      hostname: 'api.telegram.org',
      path:     `/bot${BOT_TOKEN}/sendMessage`,
      method:   'POST',
      headers:  { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(body) },
    }, res => {
      let data = ''
      res.on('data', chunk => data += chunk)
      res.on('end', () => {
        try {
          const parsed = JSON.parse(data)
          if (!parsed.ok) console.warn('[Telegram] API error:', parsed.description)
          resolve(parsed)
        } catch { resolve(null) }
      })
    })

    req.on('error', err => {
      console.warn('[Telegram] Request failed:', err.message)
      resolve(null) // Never throw — don't break chat if Telegram is down
    })

    req.write(body)
    req.end()
  })
}

/**
 * Notify admin of a new user chat message
 */
async function notifyNewChatMessage({ userName, userEmail, userPlan, messageText, conversationId }) {
  const planEmoji = { free:'⚪', basic:'🟢', gold:'🟡', platinum:'🟣' }[userPlan] || '⚪'
  const preview   = messageText.length > 120 ? messageText.slice(0, 120) + '…' : messageText

  const text = [
    `💬 <b>New chat message</b>`,
    ``,
    `<b>From:</b> ${userName} (${userEmail})`,
    `<b>Plan:</b> ${planEmoji} ${userPlan}`,
    ``,
    `<b>Message:</b>`,
    preview,
  ].join('\n')

  return sendTelegram(text)
}

/**
 * Notify admin when a new conversation is started
 */
async function notifyNewConversation({ userName, userEmail, userPlan }) {
  const text = [
    `🆕 <b>New support conversation</b>`,
    ``,
    `<b>User:</b> ${userName}`,
    `<b>Email:</b> ${userEmail}`,
    `<b>Plan:</b> ${userPlan}`,
  ].join('\n')

  return sendTelegram(text)
}

module.exports = { notifyNewChatMessage, notifyNewConversation, isConfigured }
