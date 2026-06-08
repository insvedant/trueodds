/**
 * TrueOdds — Discord OAuth2 Routes
 *
 * GET  /api/discord/connect          → redirect to Discord OAuth2 (requires auth)
 * GET  /api/discord/callback         → OAuth2 callback — saves discordId, assigns roles
 * POST /api/discord/disconnect       → unlink Discord account & remove roles
 * GET  /api/discord/status           → current link status for the settings page
 * POST /api/discord/sync             → manually re-sync roles (admin or self)
 */

const router  = require('express').Router()
const crypto  = require('crypto')
const User    = require('../models/User')
const { protect, adminOnly } = require('../middleware/auth')
const { getOAuthURL, exchangeCode, getDiscordUser, addMemberToGuild, syncRoles } = require('../services/discordService')
const { logActivity } = require('../services/logActivity')

// In-memory state store for CSRF protection (state param)
// In production you could use Redis or short-lived JWT instead
const pendingStates = new Map() // state → userId,  auto-expire 10 min

function storeState(userId) {
  const state = crypto.randomBytes(16).toString('hex')
  pendingStates.set(state, { userId, expiresAt: Date.now() + 10 * 60 * 1000 })
  return state
}

function consumeState(state) {
  const entry = pendingStates.get(state)
  if (!entry) return null
  pendingStates.delete(state)
  if (entry.expiresAt < Date.now()) return null
  return entry.userId
}

// ── GET /api/discord/connect ─────────────────────────────────────────────────
// Generates an OAuth2 URL and redirects the user to Discord to authorize.
router.get('/connect', protect, (req, res) => {
  if (!process.env.DISCORD_CLIENT_ID || !process.env.DISCORD_REDIRECT_URI) {
    return res.status(503).json({ success: false, message: 'Discord integration not configured.' })
  }
  const state = storeState(req.user._id.toString())
  const url   = getOAuthURL(state)
  res.redirect(url)
})

// ── GET /api/discord/callback ────────────────────────────────────────────────
// Discord redirects here after the user authorises.
router.get('/callback', async (req, res) => {
  const { code, state, error } = req.query
  const frontendBase = process.env.FRONTEND_URL || 'http://localhost:3000'

  if (error) {
    return res.redirect(`${frontendBase}/dashboard/settings?discord=denied`)
  }

  if (!code || !state) {
    return res.redirect(`${frontendBase}/dashboard/settings?discord=error&reason=missing_params`)
  }

  const userId = consumeState(state)
  if (!userId) {
    return res.redirect(`${frontendBase}/dashboard/settings?discord=error&reason=invalid_state`)
  }

  try {
    // Exchange code → access token → Discord user info
    const tokenData    = await exchangeCode(code)
    const discordUser  = await getDiscordUser(tokenData.access_token)

    // Check if this Discord account is already linked to a DIFFERENT TrueOdds user
    const existingLink = await User.findOne({
      discordId: discordUser.id,
      _id:       { $ne: userId },
    })
    if (existingLink) {
      return res.redirect(`${frontendBase}/dashboard/settings?discord=error&reason=already_linked`)
    }

    const user = await User.findById(userId)
    if (!user) {
      return res.redirect(`${frontendBase}/dashboard/settings?discord=error&reason=user_not_found`)
    }

    // Save Discord info on user
    user.discordId       = discordUser.id
    user.discordUsername = `${discordUser.username}${discordUser.discriminator && discordUser.discriminator !== '0' ? '#' + discordUser.discriminator : ''}`
    await user.save({ validateBeforeSave: false })

    // Auto-add them to the guild (guilds.join scope)
    await addMemberToGuild(discordUser.id, tokenData.access_token).catch(() => {})

    // Assign correct role immediately
    await syncRoles(discordUser.id, user.plan, user.subscriptionStatus)

    logActivity({ type:'discord_connected', user, message:`Discord connected: ${discordUser.username}`, meta:{ discordId: discordUser.id, discordUsername: discordUser.username } })
    return res.redirect(`${frontendBase}/dashboard/settings?discord=connected`)
  } catch (err) {
    console.error('[Discord OAuth]', err)
    return res.redirect(`${frontendBase}/dashboard/settings?discord=error&reason=server_error`)
  }
})

// ── POST /api/discord/disconnect ─────────────────────────────────────────────
router.post('/disconnect', protect, async (req, res) => {
  try {
    const { discordId } = req.user
    if (!discordId) {
      return res.status(400).json({ success: false, message: 'No Discord account linked.' })
    }

    // Remove all plan roles before unlinking
    await syncRoles(discordId, 'free', 'cancelled').catch(() => {})

    req.user.discordId       = undefined
    req.user.discordUsername = undefined
    await req.user.save({ validateBeforeSave: false })

    logActivity({ type:'discord_disconnected', user: req.user, ip: req.ip, message:`Discord unlinked`, meta:{ discordId } })
    res.json({ success: true, message: 'Discord account unlinked and roles removed.' })
  } catch (err) {
    res.status(500).json({ success: false, message: err.message })
  }
})

// ── GET /api/discord/status ──────────────────────────────────────────────────
router.get('/status', protect, (req, res) => {
  res.json({
    success:         true,
    connected:       !!req.user.discordId,
    discordId:       req.user.discordId       || null,
    discordUsername: req.user.discordUsername || null,
    plan:            req.user.plan,
    subscriptionStatus: req.user.subscriptionStatus,
  })
})

// ── POST /api/discord/sync ───────────────────────────────────────────────────
// Force a role re-sync (user can call for themselves; admin can pass ?userId=)
router.post('/sync', protect, async (req, res) => {
  try {
    let user = req.user

    // Admins can sync any user
    if (req.query.userId && req.user.role === 'admin') {
      user = await User.findById(req.query.userId)
      if (!user) return res.status(404).json({ success: false, message: 'User not found.' })
    }

    if (!user.discordId) {
      return res.status(400).json({ success: false, message: 'No Discord account linked.' })
    }

    const result = await syncRoles(user.discordId, user.plan, user.subscriptionStatus)
    res.json({ success: true, ...result })
  } catch (err) {
    res.status(500).json({ success: false, message: err.message })
  }
})

// ── POST /api/discord/sync-all (admin) ───────────────────────────────────────
// Bulk re-sync all linked users. Useful after changing role IDs.
router.post('/sync-all', protect, adminOnly, async (req, res) => {
  try {
    const users = await User.find({ discordId: { $exists: true, $ne: null } })
    const results = []
    for (const u of users) {
      const r = await syncRoles(u.discordId, u.plan, u.subscriptionStatus)
      results.push({ email: u.email, discordId: u.discordId, plan: u.plan, ...r })
      await new Promise(r => setTimeout(r, 300)) // respect Discord rate limits
    }
    res.json({ success: true, synced: results.length, results })
  } catch (err) {
    res.status(500).json({ success: false, message: err.message })
  }
})

module.exports = router
