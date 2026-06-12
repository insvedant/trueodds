/**
 * TrueOdds — Twitter/X Auto-Post Service
 * Posts arb and +EV alerts to @TrueoddsCA using OAuth 1.0a
 */

const crypto = require('crypto')
const https  = require('https')

const TWITTER_API_KEY      = process.env.TWITTER_API_KEY
const TWITTER_API_SECRET   = process.env.TWITTER_API_SECRET
const TWITTER_ACCESS_TOKEN = process.env.TWITTER_ACCESS_TOKEN
const TWITTER_ACCESS_SECRET= process.env.TWITTER_ACCESS_SECRET

function isConfigured() {
  return TWITTER_API_KEY && TWITTER_API_SECRET &&
         TWITTER_ACCESS_TOKEN && TWITTER_ACCESS_SECRET &&
         !String(TWITTER_API_KEY).includes('your_')
}

// ── OAuth 1.0a signature ─────────────────────────────────────────────────────
function percentEncode(str) {
  return encodeURIComponent(String(str))
    .replace(/!/g, '%21').replace(/'/g, '%27')
    .replace(/\(/g, '%28').replace(/\)/g, '%29').replace(/\*/g, '%2A')
}

function buildOAuthHeader(method, url, bodyParams = {}) {
  const nonce     = crypto.randomBytes(16).toString('hex')
  const timestamp = Math.floor(Date.now() / 1000).toString()

  const oauthParams = {
    oauth_consumer_key:     TWITTER_API_KEY,
    oauth_nonce:            nonce,
    oauth_signature_method: 'HMAC-SHA1',
    oauth_timestamp:        timestamp,
    oauth_token:            TWITTER_ACCESS_TOKEN,
    oauth_version:          '1.0',
  }

  const allParams = { ...oauthParams, ...bodyParams }
  const sortedParams = Object.keys(allParams).sort()
    .map(k => `${percentEncode(k)}=${percentEncode(allParams[k])}`)
    .join('&')

  const sigBase = `${method}&${percentEncode(url)}&${percentEncode(sortedParams)}`
  const sigKey  = `${percentEncode(TWITTER_API_SECRET)}&${percentEncode(TWITTER_ACCESS_SECRET)}`
  const signature = crypto.createHmac('sha1', sigKey).update(sigBase).digest('base64')

  oauthParams.oauth_signature = signature

  const header = 'OAuth ' + Object.keys(oauthParams).sort()
    .map(k => `${percentEncode(k)}="${percentEncode(oauthParams[k])}"`)
    .join(', ')

  return header
}

// ── Post tweet ───────────────────────────────────────────────────────────────
async function postTweet(text) {
  if (!isConfigured()) {
    console.warn('[Twitter] Not configured — skipping tweet')
    return { ok: false, reason: 'not_configured' }
  }

  const url  = 'https://api.twitter.com/2/tweets'
  const body = JSON.stringify({ text })

  return new Promise((resolve) => {
    const authHeader = buildOAuthHeader('POST', url)
    const req = https.request(url, {
      method:  'POST',
      headers: {
        'Authorization':  authHeader,
        'Content-Type':   'application/json',
        'Content-Length': Buffer.byteLength(body),
      },
    }, res => {
      let data = ''
      res.on('data', c => data += c)
      res.on('end', () => {
        try {
          const json = JSON.parse(data)
          if (res.statusCode >= 200 && res.statusCode < 300) {
            console.log(`[Twitter] ✅ Tweeted: "${text.slice(0, 60)}..."`)
            resolve({ ok: true, id: json.data?.id })
          } else {
            console.warn(`[Twitter] ❌ Error ${res.statusCode}:`, data)
            resolve({ ok: false, status: res.statusCode, body: data })
          }
        } catch {
          resolve({ ok: false, body: data })
        }
      })
    })
    req.on('error', err => {
      console.warn('[Twitter] Request error:', err.message)
      resolve({ ok: false, error: err.message })
    })
    req.write(body)
    req.end()
  })
}

// ── Tweet formatters ─────────────────────────────────────────────────────────

function formatArbTweet(arb, region) {
  const flag   = region === 'CA' ? '🇨🇦' : region === 'US' ? '🇺🇸' : '🇨🇦🇺🇸'
  const profit = Number(arb.profit || 0).toFixed(2)
  const b1     = (arb.b1 || '').replace(/_/g, ' ')
  const b2     = (arb.b2 || '').replace(/_/g, ' ')
  const game   = arb.game || 'Live Game'

  return [
    `⚡ LIVE ARB ALERT ${flag}`,
    ``,
    `📊 ${game}`,
    `💰 +${profit}% guaranteed profit`,
    `📚 ${b1} vs ${b2}`,
    ``,
    `🔒 Full details + calculator:`,
    `👉 trueodds.ca`,
    ``,
    `#SportsBetting #Arbitrage #BettingTips #FreePick`,
  ].join('\n').slice(0, 280)
}

function formatEVTweet(ev, region) {
  const flag  = region === 'CA' ? '🇨🇦' : region === 'US' ? '🇺🇸' : '🇨🇦🇺🇸'
  const evPct = Number(ev.ev || 0).toFixed(2)
  const book  = (ev.book || '').replace(/_/g, ' ')
  const game  = ev.game || 'Live Game'

  return [
    `📈 +EV BET ALERT ${flag}`,
    ``,
    `🏆 ${game}`,
    `💡 +${evPct}% edge vs sharp market`,
    `📚 Book: ${book}`,
    ``,
    `Positive EV bets are profitable long-term.`,
    `👉 trueodds.ca`,
    ``,
    `#SportsBetting #ValueBetting #PlusEV #BettingTips`,
  ].join('\n').slice(0, 280)
}

module.exports = { postTweet, formatArbTweet, formatEVTweet, isConfigured }
