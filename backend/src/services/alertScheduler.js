/**
 * alertScheduler.js
 * ─────────────────────────────────────────────────────────────────────────
 * Checks for hot arb/EV opportunities and emails matching subscribers.
 *
 * Thresholds:
 *  - Basic plan    : 2% arb / 3% EV  (default, not customizable)
 *  - Gold/Platinum : customizable down to 1% arb / 2% EV
 *  - HOT deal      : 5%+ always sent regardless of user threshold
 *
 * Called by:
 *  - POST /api/alerts/run-scheduler  (manual trigger from admin)
 *  - GitHub Actions cron every 30 min (via run_alerts.js script)
 *  - Auto on startup (first run after server start)
 */

const User            = require('../models/User')
const { getArbitrage, getPositiveEV } = require('./apiService')
const { sendEmail }   = require('./emailService')
const mongoose        = require('mongoose')

// Re-use Alert model from alerts route
const Alert = mongoose.models.Alert || require('../routes/alerts').Alert

const HOT_THRESHOLD = 5.0   // always notify regardless of user prefs
const MIN_THRESHOLD = 1.0   // Gold/Platinum can go this low
const COOLDOWN_MINS = 60    // don't email same user more than once per hour

// ── Plan thresholds ───────────────────────────────────────────────────────
function getMinThreshold(user) {
  const prefs = user.alertPrefs || {}
  const plan  = user.plan

  if (plan === 'basic') {
    // Basic users always get 2% minimum — not customizable
    return { arb: 2.0, ev: 3.0 }
  }
  // Gold/Platinum can customize down to 1%
  return {
    arb: Math.max(MIN_THRESHOLD, prefs.arbThreshold ?? 2.0),
    ev:  Math.max(MIN_THRESHOLD, prefs.evThreshold  ?? 3.0),
  }
}

// ── Check if user is in cooldown ──────────────────────────────────────────
function inCooldown(user) {
  const last = user.alertPrefs?.lastEmailedAt
  if (!last) return false
  const minsAgo = (Date.now() - new Date(last).getTime()) / 60000
  return minsAgo < COOLDOWN_MINS
}

// ── Build email HTML for arb opportunity ─────────────────────────────────
function buildArbEmail(user, arbs, frontendUrl) {
  const topArbs = arbs.slice(0, 5)
  const rows = topArbs.map(a => `
    <tr>
      <td style="padding:10px 12px;border-bottom:1px solid #f1f5f9">
        <strong>${a.game}</strong><br>
        <span style="font-size:12px;color:#64748b">${a.sport} · ${a.market}</span>
      </td>
      <td style="padding:10px 12px;border-bottom:1px solid #f1f5f9;text-align:center;color:#00C853;font-weight:800;font-size:16px">
        +${a.profit?.toFixed(2)}%
      </td>
      <td style="padding:10px 12px;border-bottom:1px solid #f1f5f9;text-align:center;font-size:12px;color:#64748b">
        ${a.b1} vs ${a.b2}
      </td>
    </tr>
  `).join('')

  const bestProfit = Math.max(...arbs.map(a => a.profit || 0)).toFixed(2)
  const isHot      = parseFloat(bestProfit) >= HOT_THRESHOLD

  return `
    <!DOCTYPE html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
    <style>
      body { font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif; background:#f8fafc; margin:0; padding:0; }
      .container { max-width:560px; margin:32px auto; background:#fff; border-radius:12px; overflow:hidden; box-shadow:0 2px 12px rgba(0,0,0,0.08); }
      .header { background:#080b12; padding:24px 32px; text-align:center; }
      .logo { font-size:20px; font-weight:900; color:#e6edf3; }
      .logo span { color:#00C853; }
      .badge { display:inline-block; background:${isHot?'#ef4444':'#00C853'}; color:#fff; font-size:11px; font-weight:800; padding:3px 10px; border-radius:20px; margin-top:8px; text-transform:uppercase; letter-spacing:0.5px; }
      .body { padding:28px 32px; }
      .title { font-size:18px; font-weight:800; color:#1e293b; margin-bottom:8px; }
      .subtitle { font-size:14px; color:#64748b; margin-bottom:20px; line-height:1.6; }
      table { width:100%; border-collapse:collapse; margin-bottom:20px; }
      th { padding:8px 12px; background:#f8fafc; font-size:11px; color:#94a3b8; text-align:left; text-transform:uppercase; letter-spacing:0.5px; }
      .btn { display:inline-block; background:#00C853; color:#000; font-weight:800; font-size:14px; padding:12px 28px; border-radius:9px; text-decoration:none; }
      .footer { padding:16px 32px; background:#f8fafc; font-size:11px; color:#94a3b8; text-align:center; line-height:1.75; }
      .footer a { color:#94a3b8; }
      .unsubscribe { font-size:11px; color:#cbd5e1; margin-top:8px; }
    </style></head><body>
    <div class="container">
      <div class="header">
        <div class="logo">True<span>Odds</span></div>
        <div class="badge">${isHot ? '🔥 Hot Deal' : '⚡ New Arb Alert'}</div>
      </div>
      <div class="body">
        <div class="title">
          ${isHot ? '🔥 Hot arbitrage opportunity!' : `${arbs.length} new arbitrage ${arbs.length === 1 ? 'opportunity' : 'opportunities'}`}
        </div>
        <div class="subtitle">
          Best profit: <strong style="color:#00C853">+${bestProfit}% guaranteed</strong> on ${topArbs[0]?.sport || 'upcoming games'}.
          These close fast — act now.
        </div>
        <table>
          <thead><tr>
            <th>Event</th><th style="text-align:center">Profit</th><th style="text-align:center">Books</th>
          </tr></thead>
          <tbody>${rows}</tbody>
        </table>
        <a href="${frontendUrl}/dashboard/arbitrage" class="btn">View All Opportunities →</a>
      </div>
      <div class="footer">
        TrueOdds, Inc. · <a href="${frontendUrl}">trueodds.ca</a><br>
        Must be 19+ · Bet responsibly · <a href="${frontendUrl}/dashboard/settings">Manage alerts</a>
      </div>
    </div>
    </body></html>
  `
}

// ── Build email HTML for +EV opportunity ─────────────────────────────────
function buildEVEmail(user, evBets, frontendUrl) {
  const topBets = evBets.slice(0, 5)
  const rows = topBets.map(b => `
    <tr>
      <td style="padding:10px 12px;border-bottom:1px solid #f1f5f9">
        <strong>${b.game}</strong><br>
        <span style="font-size:12px;color:#64748b">${b.sport} · ${b.market}</span>
      </td>
      <td style="padding:10px 12px;border-bottom:1px solid #f1f5f9;text-align:center;color:#3b82f6;font-weight:800;font-size:16px">
        +${b.ev?.toFixed(1)}%
      </td>
      <td style="padding:10px 12px;border-bottom:1px solid #f1f5f9;text-align:center;font-size:13px;font-weight:700;color:#00C853">
        ${b.bookOdds}
      </td>
    </tr>
  `).join('')

  return `
    <!DOCTYPE html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
    <style>
      body { font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif; background:#f8fafc; margin:0; padding:0; }
      .container { max-width:560px; margin:32px auto; background:#fff; border-radius:12px; overflow:hidden; box-shadow:0 2px 12px rgba(0,0,0,0.08); }
      .header { background:#080b12; padding:24px 32px; text-align:center; }
      .logo { font-size:20px; font-weight:900; color:#e6edf3; }
      .logo span { color:#00C853; }
      .badge { display:inline-block; background:#3b82f6; color:#fff; font-size:11px; font-weight:800; padding:3px 10px; border-radius:20px; margin-top:8px; text-transform:uppercase; letter-spacing:0.5px; }
      .body { padding:28px 32px; }
      .title { font-size:18px; font-weight:800; color:#1e293b; margin-bottom:8px; }
      .subtitle { font-size:14px; color:#64748b; margin-bottom:20px; line-height:1.6; }
      table { width:100%; border-collapse:collapse; margin-bottom:20px; }
      th { padding:8px 12px; background:#f8fafc; font-size:11px; color:#94a3b8; text-align:left; text-transform:uppercase; letter-spacing:0.5px; }
      .btn { display:inline-block; background:#3b82f6; color:#fff; font-weight:800; font-size:14px; padding:12px 28px; border-radius:9px; text-decoration:none; }
      .footer { padding:16px 32px; background:#f8fafc; font-size:11px; color:#94a3b8; text-align:center; line-height:1.75; }
      .footer a { color:#94a3b8; }
    </style></head><body>
    <div class="container">
      <div class="header">
        <div class="logo">True<span>Odds</span></div>
        <div class="badge">📈 +EV Alert</div>
      </div>
      <div class="body">
        <div class="title">${evBets.length} positive EV ${evBets.length === 1 ? 'bet' : 'bets'} found</div>
        <div class="subtitle">
          These bets are mathematically profitable long-term. Best edge: <strong style="color:#3b82f6">+${Math.max(...evBets.map(b=>b.ev||0)).toFixed(1)}% EV</strong>.
        </div>
        <table>
          <thead><tr>
            <th>Event</th><th style="text-align:center">EV%</th><th style="text-align:center">Odds</th>
          </tr></thead>
          <tbody>${rows}</tbody>
        </table>
        <a href="${frontendUrl}/dashboard/positive-ev" class="btn">View All +EV Bets →</a>
      </div>
      <div class="footer">
        TrueOdds, Inc. · <a href="${frontendUrl}">trueodds.ca</a><br>
        Must be 19+ · Bet responsibly · <a href="${frontendUrl}/dashboard/settings">Manage alerts</a>
      </div>
    </div>
    </body></html>
  `
}

// ── Main scheduler function ───────────────────────────────────────────────
async function runAlertScheduler() {
  const frontendUrl = process.env.FRONTEND_URL || 'https://trueodds.ca'
  console.log('[AlertScheduler] Starting run at', new Date().toISOString())

  try {
    // 1. Fetch current opportunities
    const [arbResult, evResult] = await Promise.allSettled([
      getArbitrage(0, null),
      getPositiveEV(0, null),
    ])

    const arbs   = arbResult.status   === 'fulfilled' ? (arbResult.value.data   || []) : []
    const evBets = evResult.status    === 'fulfilled' ? (evResult.value.data    || []) : []

    if (arbs.length === 0 && evBets.length === 0) {
      console.log('[AlertScheduler] No opportunities found — skipping')
      return { sent: 0, skipped: 0 }
    }

    console.log(`[AlertScheduler] Found ${arbs.length} arbs, ${evBets.length} EV bets`)

    // 2. Get all eligible subscribers (basic, gold, platinum with active/trial status)
    const users = await User.find({
      plan:               { $in: ['basic', 'gold', 'platinum'] },
      subscriptionStatus: { $in: ['active', 'trial'] },
      'alertPrefs.emailAlerts': { $ne: false },
    }).select('name email plan alertPrefs')

    console.log(`[AlertScheduler] ${users.length} eligible subscribers`)

    let sent = 0, skipped = 0

    for (const user of users) {
      try {
        // Skip if in cooldown
        if (inCooldown(user)) { skipped++; continue }

        const threshold = getMinThreshold(user)
        const prefs     = user.alertPrefs || {}

        // Filter arbs by user threshold + sport preference
        const matchingArbs = arbs.filter(a => {
          const profit = a.profit || 0
          if (profit < threshold.arb && profit < HOT_THRESHOLD) return false
          if (prefs.sports?.length > 0 && !prefs.sports.includes(a.sport)) return false
          if (prefs.hotDealsOnly && profit < HOT_THRESHOLD) return false
          return true
        })

        // Filter EV bets (gold/platinum only)
        const matchingEV = ['gold','platinum'].includes(user.plan) ? evBets.filter(b => {
          const ev = b.ev || 0
          if (ev < threshold.ev && ev < HOT_THRESHOLD) return false
          if (prefs.sports?.length > 0 && !prefs.sports.includes(b.sport)) return false
          return true
        }) : []

        if (matchingArbs.length === 0 && matchingEV.length === 0) {
          skipped++; continue
        }

        // Build and send email
        let subject, html
        if (matchingArbs.length > 0) {
          const bestProfit = Math.max(...matchingArbs.map(a => a.profit || 0))
          const isHot      = bestProfit >= HOT_THRESHOLD
          subject = isHot
            ? `🔥 Hot arb alert: +${bestProfit.toFixed(2)}% guaranteed profit`
            : `⚡ ${matchingArbs.length} new arb ${matchingArbs.length===1?'opportunity':'opportunities'} (best: +${bestProfit.toFixed(2)}%)`
          html = buildArbEmail(user, matchingArbs, frontendUrl)
        } else {
          const bestEV = Math.max(...matchingEV.map(b => b.ev || 0))
          subject = `📈 ${matchingEV.length} +EV ${matchingEV.length===1?'bet':'bets'} found (best: +${bestEV.toFixed(1)}% EV)`
          html = buildEVEmail(user, matchingEV, frontendUrl)
        }

        await sendEmail({ to: user.email, subject, html })

        // Save in-app alert
        if (Alert) {
          const topArb = matchingArbs[0]
          await Alert.create({
            user:    user._id,
            type:    matchingArbs.length > 0 ? 'arb' : 'ev',
            title:   subject,
            message: matchingArbs.length > 0
              ? `${matchingArbs[0]?.game} — +${matchingArbs[0]?.profit?.toFixed(2)}% profit`
              : `${matchingEV[0]?.game} — +${matchingEV[0]?.ev?.toFixed(1)}% EV`,
            value:   matchingArbs.length > 0
              ? `+${matchingArbs[0]?.profit?.toFixed(2)}%`
              : `+${matchingEV[0]?.ev?.toFixed(1)}%`,
            sport:   matchingArbs[0]?.sport || matchingEV[0]?.sport,
          })
        }

        // Update lastEmailedAt to enforce cooldown
        await User.updateOne(
          { _id: user._id },
          { 'alertPrefs.lastEmailedAt': new Date() }
        )

        sent++
        console.log(`[AlertScheduler] Sent to ${user.email} (${user.plan}) — ${matchingArbs.length} arbs, ${matchingEV.length} EV`)

      } catch (err) {
        console.error(`[AlertScheduler] Failed for ${user.email}:`, err.message)
        skipped++
      }
    }

    console.log(`[AlertScheduler] Done — sent: ${sent}, skipped: ${skipped}`)
    return { sent, skipped, arbs: arbs.length, evBets: evBets.length }

  } catch (err) {
    console.error('[AlertScheduler] Fatal error:', err.message)
    return { sent: 0, error: err.message }
  }
}

module.exports = { runAlertScheduler }
