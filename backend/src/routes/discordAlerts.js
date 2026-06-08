/**
 * TrueOdds — Discord Webhook Alerts
 * File: backend/src/routes/discordAlerts.js
 *
 * Trigger via Render Cron Job every 60s:
 *   POST https://trueodds.onrender.com/api/cron/discord-alerts
 *   Header: x-cron-secret: YOUR_CRON_SECRET
 *
 * Required env vars on Render:
 *   CRON_SECRET          — any random string e.g. "abc123xyz"
 *   DISCORD_BASIC_ARB    — webhook URL for #arbitrage-basic
 *   DISCORD_BASIC_EV     — webhook URL for #positive-ev-basic
 *   DISCORD_BASIC_ODDS   — webhook URL for #odds-basic-updates
 *   DISCORD_GOLD_ARB     — webhook URL for #gold-arbitrage-updates
 *   DISCORD_GOLD_EV      — webhook URL for #gold-positive-ev-updates
 *   DISCORD_GOLD_ODDS    — webhook URL for #gold-odds-updates
 *   DISCORD_PLAT_ARB     — webhook URL for #platinum-arbitrage-up
 *   DISCORD_PLAT_EV      — webhook URL for #platinum-positive-ev
 *   DISCORD_PLAT_ODDS    — webhook URL for #platinum-odds-updates
 */

const express  = require('express')
const router   = express.Router()
const mongoose = require('mongoose')

// ─────────────────────────────────────────────
// Book → Region mapping
// ─────────────────────────────────────────────
const CA_BOOKS = new Set([
  'sports_interaction','bet365','tonybet','tooniebet','playnow',
  'casumo','betway','thescore','unibet','bodog','888sport',
])
const US_BOOKS = new Set([
  'fanduel','draftkings','betmgm','caesars','betrivers','espnbet',
  'hardrockbet','pointsbet','fanatics','wynnbet','barstool',
  'fliff','bet_us','superbook',
])

function detectRegion(b1 = '', b2 = '') {
  const books = [b1.toLowerCase().replace(/_ca|_us/g,''), b2.toLowerCase().replace(/_ca|_us/g,'')]
  const caCount = books.filter(b => CA_BOOKS.has(b)).length
  const usCount = books.filter(b => US_BOOKS.has(b)).length
  if (caCount > 0 && usCount === 0) return 'CA'
  if (usCount > 0 && caCount === 0) return 'US'
  return 'BOTH'
}

const FLAG = { CA: '🇨🇦', US: '🇺🇸', BOTH: '🇨🇦🇺🇸' }
const REGION_TEXT = {
  CA:   'Canada only — Sports Interaction, Bet365 CA, etc.',
  US:   'USA only — FanDuel, DraftKings, BetMGM, etc.',
  BOTH: 'Available in Canada 🇨🇦 and USA 🇺🇸',
}

const SPORT_EMOJI = {
  NHL:'🏒', NBA:'🏀', MLB:'⚾', NFL:'🏈', CFL:'🏈',
  Soccer:'⚽', Tennis:'🎾', UFC:'🥊', Boxing:'🥊', Golf:'⛳',
}

// ─────────────────────────────────────────────
// Tier thresholds
// ─────────────────────────────────────────────
// Basic gets alerts for >= 1% arb, >= 2% EV
// Gold  gets alerts for >= 1.5% arb, >= 2.5% EV
// Plat  gets ALL alerts >= 0.5% arb, >= 1.5% EV
function getArbTiers(profit) {
  const t = []
  if (profit >= 1.0) t.push('platinum')  // platinum gets everything ≥ 1%
  if (profit >= 2.5) t.push('gold')       // gold gets solid arbs ≥ 2.5%
  if (profit >= 4.0) t.push('basic')      // basic gets only rare hot arbs ≥ 4%
  return [...new Set(t)]
}
function getEVTiers(ev) {
  const t = []
  if (ev >= 1.5) t.push('platinum')  // platinum gets everything ≥ 1.5%
  if (ev >= 3.0) t.push('gold')       // gold gets ≥ 3%
  if (ev >= 5.0) t.push('basic')      // basic gets only strong EV ≥ 5%
  return [...new Set(t)]
}

// ─────────────────────────────────────────────
// Webhook sender
// ─────────────────────────────────────────────
async function sendWebhook(url, payload) {
  if (!url) return { skipped: true }
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  })
  if (!res.ok) return { ok: false, status: res.status, body: await res.text() }
  return { ok: true }
}

// ─────────────────────────────────────────────
// Discord embed builders
// ─────────────────────────────────────────────
function arbEmbed(arb, region) {
  const flag   = FLAG[region]
  const emoji  = SPORT_EMOJI[arb.sport] || '🏅'
  const profit = Number(arb.profit || 0).toFixed(2)
  const isHot  = arb.profit >= 4
  const stake  = Math.round((arb.profit / 100) * 1000)

  const b1 = (arb.b1 || '').replace(/_/g, ' ')
  const b2 = (arb.b2 || '').replace(/_/g, ' ')

  const legs = (arb.legs || []).map(l =>
    `> **${(l.book || '').replace(/_/g,' ')}** — ${l.outcome || ''} @ \`${l.odds || ''}\`  Stake: $${l.stake || '?'}`
  ).join('\n') || '> See platform for full details'

  return {
    username: 'TrueOdds Alerts',
    avatar_url: 'https://trueodds.ca/favicon.ico',
    embeds: [{
      color: isHot ? 0xFF4444 : 0x00C853,
      author: {
        name: `${isHot ? '🔥 HOT ARB' : '⚡ Arbitrage Alert'} ${flag}`,
        url: 'https://trueodds.ca/dashboard/arbitrage',
        icon_url: 'https://trueodds.ca/favicon.ico',
      },
      title: `${emoji}  ${arb.game || 'Unknown game'}`,
      url: 'https://trueodds.ca/dashboard/arbitrage',
      description: [
        `**Guaranteed profit: \`+${profit}%\`** ($${stake} on $1,000 stake)`,
        `**Market:** ${arb.market || 'Moneyline'}  |  **Time:** ${arb.time || 'Soon'}`,
        '',
        '**📋 Betting legs:**',
        legs,
        '',
        `**${REGION_TEXT[region]}**`,
      ].join('\n'),
      fields: [
        { name: '📚 Book A', value: b1 || '—', inline: true },
        { name: '📚 Book B', value: b2 || '—', inline: true },
        { name: '💰 Profit', value: `+${profit}%`, inline: true },
      ],
      footer: {
        text: `TrueOdds • Act fast — arbitrage windows close in 30–120 seconds`,
        icon_url: 'https://trueodds.ca/favicon.ico',
      },
      timestamp: new Date().toISOString(),
    }],
    components: [{
      type: 1,
      components: [
        { type: 2, style: 5, label: '⚡ View Arb on TrueOdds', url: 'https://trueodds.ca/dashboard/arbitrage' },
        { type: 2, style: 5, label: '🔑 Sign Up Free', url: 'https://trueodds.ca/signup' },
      ],
    }],
  }
}

function evEmbed(ev, region) {
  const flag  = FLAG[region]
  const emoji = SPORT_EMOJI[ev.sport] || '🏅'
  const evPct = Number(ev.ev || 0).toFixed(2)

  return {
    username: 'TrueOdds Alerts',
    avatar_url: 'https://trueodds.ca/favicon.ico',
    embeds: [{
      color: 0x8957E5,
      author: {
        name: `📈 +EV Bet Alert ${flag}`,
        url: 'https://trueodds.ca/dashboard/positive-ev',
        icon_url: 'https://trueodds.ca/favicon.ico',
      },
      title: `${emoji}  ${ev.game || 'Unknown game'}`,
      url: 'https://trueodds.ca/dashboard/positive-ev',
      description: [
        `**Expected value: \`+${evPct}%\`** edge over sharp market`,
        `**Outcome:** ${ev.outcome || 'See platform'}  |  **Odds:** \`${ev.odds || 'N/A'}\``,
        `**Book:** ${(ev.book || '').replace(/_/g,' ')}  |  **Market:** ${ev.market || 'Moneyline'}`,
        '',
        `**${REGION_TEXT[region]}**`,
      ].join('\n'),
      fields: [
        { name: '📚 Book',    value: (ev.book || '—').replace(/_/g,' '), inline: true },
        { name: '🎯 EV',      value: `+${evPct}%`, inline: true },
        { name: '🏆 Sport',   value: ev.sport || '—', inline: true },
      ],
      footer: {
        text: 'TrueOdds • +EV bets are profitable long-term even without guarantees',
        icon_url: 'https://trueodds.ca/favicon.ico',
      },
      timestamp: new Date().toISOString(),
    }],
    components: [{
      type: 1,
      components: [
        { type: 2, style: 5, label: '📈 View +EV Bets', url: 'https://trueodds.ca/dashboard/positive-ev' },
        { type: 2, style: 5, label: '🔑 Sign Up Free', url: 'https://trueodds.ca/signup' },
      ],
    }],
  }
}

function oddsEmbed(game) {
  const emoji  = SPORT_EMOJI[game.sport] || '🏅'
  const isLive = game.isLive

  // Build a compact best-odds table from the first market (Moneyline)
  const mkt  = (game.markets || [])[0]
  const rows = (mkt?.rows || []).slice(0, 4) // max 4 outcomes (handles draws etc.)

  const lines = rows.map(r => {
    const bookName = (r.bestBook || '').replace(/_/g, ' ')
    return `> **${r.selection}** — \`${r.bestOdds}\` @ ${bookName}  *(avg ${r.avgOdds})*`
  }).join('\n') || '> See platform for full details'

  const bookCount = rows.reduce((n, r) => n + Object.keys(r.books || {}).length, 0)

  return {
    username:   'TrueOdds Alerts',
    avatar_url: 'https://trueodds.ca/favicon.ico',
    embeds: [{
      color: isLive ? 0xFF4444 : 0x3B82F6,
      author: {
        name:     `${isLive ? '🔴 LIVE' : '📊 Best Odds'} — ${game.sport}`,
        url:      'https://trueodds.ca/dashboard/odds',
        icon_url: 'https://trueodds.ca/favicon.ico',
      },
      title: `${emoji}  ${game.game}`,
      url:   'https://trueodds.ca/dashboard/odds',
      description: [
        `**Market:** ${mkt?.name || 'Moneyline'}  |  **${isLive ? '🔴 In Progress' : `🕐 ${game.time}`}**`,
        `**League:** ${game.league || game.sport}`,
        '',
        '**💰 Best available odds:**',
        lines,
        '',
        `Compared across **${bookCount}** bookmaker lines`,
      ].join('\n'),
      footer: {
        text:     'TrueOdds • Odds update every 60s — shop lines to maximise value',
        icon_url: 'https://trueodds.ca/favicon.ico',
      },
      timestamp: new Date().toISOString(),
    }],
    components: [{
      type: 1,
      components: [
        { type: 2, style: 5, label: '📊 View Full Odds', url: 'https://trueodds.ca/dashboard/odds' },
        { type: 2, style: 5, label: '🔑 Sign Up Free',  url: 'https://trueodds.ca/signup' },
      ],
    }],
  }
}

// ─────────────────────────────────────────────
// AlertSent model (TTL: 1 hour auto-expire)
// ─────────────────────────────────────────────
const alertSchema = new mongoose.Schema({
  alertId: { type: String, required: true, unique: true },
  type:    { type: String },
  profit:  { type: Number },
  region:  { type: String },
  sentAt:  { type: Date, default: Date.now },
}, { timestamps: false })
alertSchema.index({ sentAt: 1 }, { expireAfterSeconds: 3600 })

const AlertSent = mongoose.models.AlertSent || mongoose.model('AlertSent', alertSchema)

// ─────────────────────────────────────────────
// Webhooks map
// ─────────────────────────────────────────────
function webhooks() {
  return {
    basic:    { arb: process.env.DISCORD_BASIC_ARB,  ev: process.env.DISCORD_BASIC_EV,  odds: process.env.DISCORD_BASIC_ODDS  },
    gold:     { arb: process.env.DISCORD_GOLD_ARB,   ev: process.env.DISCORD_GOLD_EV,   odds: process.env.DISCORD_GOLD_ODDS   },
    platinum: { arb: process.env.DISCORD_PLAT_ARB,   ev: process.env.DISCORD_PLAT_EV,   odds: process.env.DISCORD_PLAT_ODDS   },
  }
}

// ─────────────────────────────────────────────
// Auth middleware
// ─────────────────────────────────────────────
function cronAuth(req, res, next) {
  const secret = req.headers['x-cron-secret'] || req.query.secret
  if (process.env.CRON_SECRET && secret !== process.env.CRON_SECRET) {
    return res.status(401).json({ success: false, message: 'Unauthorized — set x-cron-secret header' })
  }
  next()
}

// ─────────────────────────────────────────────
// POST /api/cron/discord-alerts — main handler
// ─────────────────────────────────────────────
router.post('/', cronAuth, async (req, res) => {
  const WH      = webhooks()
  const results = { arbs_checked: 0, arbs_sent: 0, ev_checked: 0, ev_sent: 0, odds_checked: 0, odds_sent: 0, skipped: 0, errors: [] }
  const log     = []

  try {
    // ── Fetch arbs via internal API ──────────────────────────────────────────
    const apiService = require('../services/apiService')
    const { data: allArbs } = await apiService.getArbitrage(0, null)

    // Top 3 by profit, min 0.5%
    const topArbs = (allArbs || [])
      .filter(a => a.profit >= 0.5)
      .sort((a, b) => b.profit - a.profit)
      .slice(0, 3)

    results.arbs_checked = topArbs.length

    for (const arb of topArbs) {
      const alertId = `arb_${(arb.id || arb.game || '').replace(/\s/g,'_')}_${Math.round(arb.profit * 10)}`
      const exists  = await AlertSent.findOne({ alertId })
      if (exists) { results.skipped++; continue }

      const region  = detectRegion(arb.b1, arb.b2)
      const tiers   = getArbTiers(arb.profit)
      const payload = arbEmbed(arb, region)
      const sent    = []

      for (const tier of tiers) {
        const r = await sendWebhook(WH[tier]?.arb, payload)
        if (r.ok) { sent.push(tier); log.push(`✅ arb → ${tier} (${arb.game}, ${arb.profit}%)`) }
        else if (!r.skipped) { results.errors.push({ tier, type: 'arb', ...r }); log.push(`❌ arb → ${tier}: ${r.status || r.error}`) }
        await new Promise(r => setTimeout(r, 500)) // rate limit
      }

      if (sent.length) {
        await AlertSent.create({ alertId, type: 'arb', profit: arb.profit, region })
        results.arbs_sent++
      }
    }

    // ── Fetch +EV bets ───────────────────────────────────────────────────────
    try {
      const { data: allEV } = await apiService.getPositiveEV(1.5, null)
      const topEV = (allEV || [])
        .filter(e => e.ev >= 1.5)
        .sort((a, b) => b.ev - a.ev)
        .slice(0, 2)

      results.ev_checked = topEV.length

      for (const ev of topEV) {
        const alertId = `ev_${(ev.game || '').replace(/\s/g,'_')}_${(ev.book || '').replace(/\s/g,'_')}_${Math.round(ev.ev * 10)}`
        const exists  = await AlertSent.findOne({ alertId })
        if (exists) { results.skipped++; continue }

        const region  = detectRegion(ev.book, '')
        const tiers   = getEVTiers(ev.ev)
        const payload = evEmbed(ev, region)
        const sent    = []

        for (const tier of tiers) {
          const r = await sendWebhook(WH[tier]?.ev, payload)
          if (r.ok) { sent.push(tier); log.push(`✅ ev → ${tier} (${ev.game}, ${ev.ev}%)`) }
          else if (!r.skipped) { results.errors.push({ tier, type: 'ev', ...r }); log.push(`❌ ev → ${tier}: ${r.status || r.error}`) }
          await new Promise(r => setTimeout(r, 500))
        }

        if (sent.length) {
          await AlertSent.create({ alertId, type: 'ev', profit: ev.ev, region })
          results.ev_sent++
        }
      }
    } catch (evErr) {
      results.errors.push({ type: 'ev_fetch', error: evErr.message })
      log.push(`⚠️ EV fetch error: ${evErr.message}`)
    }

    // ── Fetch Live Odds ──────────────────────────────────────────────────────
    // Send top 3 upcoming/live games with the most books posting lines.
    // Dedup TTL is 1 hour so each game only fires once per hour.
    try {
      const { data: allOdds } = await apiService.getAllOdds()

      // Pick games that have at least 3 books and are within 48h or live
      const now = Date.now()
      const topGames = (allOdds || [])
        .filter(g => {
          const mkt   = (g.markets || [])[0]
          const books = (mkt?.rows || []).reduce((n, r) => n + Object.keys(r.books || {}).length, 0)
          return books >= 3
        })
        .sort((a, b) => {
          // live games first, then soonest upcoming
          if (a.isLive !== b.isLive) return a.isLive ? -1 : 1
          return 0
        })
        .slice(0, 3)

      results.odds_checked = topGames.length

      for (const game of topGames) {
        const alertId = `odds_${(game.id || game.game || '').replace(/\s/g,'_')}`
        const exists  = await AlertSent.findOne({ alertId })
        if (exists) { results.skipped++; continue }

        const payload = oddsEmbed(game)
        const sent    = []

        // Odds go to ALL tiers (basic gets the same odds data — it's a preview/value tool)
        for (const tier of ['platinum', 'gold', 'basic']) {
          const r = await sendWebhook(WH[tier]?.odds, payload)
          if (r.ok) { sent.push(tier); log.push(`✅ odds → ${tier} (${game.game})`) }
          else if (!r.skipped) { results.errors.push({ tier, type: 'odds', ...r }); log.push(`❌ odds → ${tier}: ${r.status || r.error}`) }
          await new Promise(r => setTimeout(r, 500))
        }

        if (sent.length) {
          await AlertSent.create({ alertId, type: 'odds', profit: 0, region: 'BOTH' })
          results.odds_sent++
        }
      }
    } catch (oddsErr) {
      results.errors.push({ type: 'odds_fetch', error: oddsErr.message })
      log.push(`⚠️ Odds fetch error: ${oddsErr.message}`)
    }

    res.json({ success: true, timestamp: new Date().toISOString(), ...results, log })

  } catch (err) {
    console.error('[Discord Alerts]', err)
    res.status(500).json({ success: false, message: err.message, log })
  }
})

// ─────────────────────────────────────────────
// GET /api/cron/discord-alerts — status/test
// ─────────────────────────────────────────────
router.get('/', cronAuth, async (req, res) => {
  try {
    const recent = await AlertSent.find().sort({ sentAt: -1 }).limit(10)
    const WH     = webhooks()
    const status = Object.entries(WH).reduce((acc, [plan, types]) => {
      acc[plan] = Object.fromEntries(Object.entries(types).map(([t, url]) => [t, url ? '✅ configured' : '❌ missing']))
      return acc
    }, {})
    res.json({ success: true, webhook_status: status, recent_alerts: recent })
  } catch (err) {
    res.status(500).json({ success: false, message: err.message })
  }
})

module.exports = router
