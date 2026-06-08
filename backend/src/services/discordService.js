/**
 * TrueOdds — Discord Role Sync Service
 *
 * Uses the Discord Bot API to assign / remove roles based on subscription plan.
 *
 * Required env vars:
 *   DISCORD_BOT_TOKEN      — Bot token from Discord Developer Portal
 *   DISCORD_GUILD_ID       — Your server (guild) ID
 *   DISCORD_ROLE_BASIC     — Role ID for Basic subscribers
 *   DISCORD_ROLE_GOLD      — Role ID for Gold subscribers
 *   DISCORD_ROLE_PLATINUM  — Role ID for Platinum subscribers
 *
 * Optional (for OAuth2 "Connect Discord" flow):
 *   DISCORD_CLIENT_ID      — OAuth2 App Client ID
 *   DISCORD_CLIENT_SECRET  — OAuth2 App Client Secret
 *   DISCORD_REDIRECT_URI   — e.g. https://trueodds.ca/api/discord/callback
 */

const DISCORD_API = 'https://discord.com/api/v10'

// Map plan name → env var holding that plan's Role ID
const PLAN_ROLE_ENV = {
  basic:    'DISCORD_ROLE_BASIC',
  gold:     'DISCORD_ROLE_GOLD',
  platinum: 'DISCORD_ROLE_PLATINUM',
}

function botHeaders() {
  return {
    Authorization: `Bot ${process.env.DISCORD_BOT_TOKEN}`,
    'Content-Type': 'application/json',
    'X-Audit-Log-Reason': 'TrueOdds subscription sync',
  }
}

/**
 * Returns the Role ID for the given plan, or null if not configured.
 */
function roleIdForPlan(plan) {
  const envKey = PLAN_ROLE_ENV[plan]
  return envKey ? (process.env[envKey] || null) : null
}

/**
 * Add a role to a guild member. Silently succeeds if bot token / guild not configured.
 */
async function addRole(discordUserId, roleId) {
  if (!process.env.DISCORD_BOT_TOKEN || !process.env.DISCORD_GUILD_ID) return { skipped: true }
  const res = await fetch(
    `${DISCORD_API}/guilds/${process.env.DISCORD_GUILD_ID}/members/${discordUserId}/roles/${roleId}`,
    { method: 'PUT', headers: botHeaders() }
  )
  // 204 = success, 404 = member not in server yet (that's fine — role assigned on join via the sync)
  return { ok: res.status === 204, status: res.status }
}

/**
 * Remove a role from a guild member.
 */
async function removeRole(discordUserId, roleId) {
  if (!process.env.DISCORD_BOT_TOKEN || !process.env.DISCORD_GUILD_ID) return { skipped: true }
  const res = await fetch(
    `${DISCORD_API}/guilds/${process.env.DISCORD_GUILD_ID}/members/${discordUserId}/roles/${roleId}`,
    { method: 'DELETE', headers: botHeaders() }
  )
  return { ok: res.status === 204, status: res.status }
}

/**
 * Fetch a guild member object (to check current roles).
 */
async function getMember(discordUserId) {
  if (!process.env.DISCORD_BOT_TOKEN || !process.env.DISCORD_GUILD_ID) return null
  const res = await fetch(
    `${DISCORD_API}/guilds/${process.env.DISCORD_GUILD_ID}/members/${discordUserId}`,
    { headers: botHeaders() }
  )
  if (!res.ok) return null
  return res.json()
}

/**
 * Core sync: ensure the Discord user has exactly the right plan role
 * and no stale plan roles from a previous tier.
 *
 * @param {string} discordUserId  — Discord snowflake ID (stored on User model)
 * @param {string} plan           — 'free' | 'basic' | 'gold' | 'platinum'
 * @param {string} subscriptionStatus — 'active' | 'trial' | 'cancelled' | 'inactive' | 'past_due'
 */
async function syncRoles(discordUserId, plan, subscriptionStatus) {
  if (!discordUserId) return { skipped: true, reason: 'no_discord_id' }
  if (!process.env.DISCORD_BOT_TOKEN || !process.env.DISCORD_GUILD_ID) {
    return { skipped: true, reason: 'bot_not_configured' }
  }

  const isActive = ['active', 'trial'].includes(subscriptionStatus)
  const targetRoleId = isActive ? roleIdForPlan(plan) : null

  const results = {}

  // Add the correct plan role (if active and configured)
  if (targetRoleId) {
    results.add = await addRole(discordUserId, targetRoleId)
  }

  // Remove roles from all OTHER tiers to avoid stacking
  for (const [tierPlan, envKey] of Object.entries(PLAN_ROLE_ENV)) {
    if (tierPlan === plan && isActive) continue // keep the active plan role
    const roleId = process.env[envKey]
    if (!roleId) continue
    results[`remove_${tierPlan}`] = await removeRole(discordUserId, roleId)
  }

  console.log(`[Discord] syncRoles user=${discordUserId} plan=${plan} status=${subscriptionStatus}`, results)
  return { ok: true, results }
}

// ─────────────────────────────────────────────────────────────────────────────
// OAuth2 helpers (for the "Connect Discord" button in settings)
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Build the Discord OAuth2 authorization URL.
 * Scopes: identify (get user info) + guilds.join (add them to the server automatically)
 */
function getOAuthURL(state) {
  const params = new URLSearchParams({
    client_id:     process.env.DISCORD_CLIENT_ID || '',
    redirect_uri:  process.env.DISCORD_REDIRECT_URI || '',
    response_type: 'code',
    scope:         'identify guilds.join',
    state,
  })
  return `https://discord.com/oauth2/authorize?${params}`
}

/**
 * Exchange an OAuth2 code for an access token.
 */
async function exchangeCode(code) {
  const body = new URLSearchParams({
    client_id:     process.env.DISCORD_CLIENT_ID,
    client_secret: process.env.DISCORD_CLIENT_SECRET,
    grant_type:    'authorization_code',
    code,
    redirect_uri:  process.env.DISCORD_REDIRECT_URI,
  })
  const res = await fetch(`${DISCORD_API}/oauth2/token`, {
    method:  'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body,
  })
  if (!res.ok) throw new Error(`Token exchange failed: ${res.status}`)
  return res.json() // { access_token, token_type, scope, ... }
}

/**
 * Fetch the Discord user profile using an OAuth2 access token.
 */
async function getDiscordUser(accessToken) {
  const res = await fetch(`${DISCORD_API}/users/@me`, {
    headers: { Authorization: `Bearer ${accessToken}` },
  })
  if (!res.ok) throw new Error(`Failed to fetch Discord user: ${res.status}`)
  return res.json() // { id, username, discriminator, avatar, ... }
}

/**
 * Add the Discord user to the guild automatically (requires guilds.join scope).
 * This lets us add them to the server the moment they connect — they don't need
 * to find an invite link.
 */
async function addMemberToGuild(discordUserId, accessToken) {
  if (!process.env.DISCORD_BOT_TOKEN || !process.env.DISCORD_GUILD_ID) return { skipped: true }
  const res = await fetch(
    `${DISCORD_API}/guilds/${process.env.DISCORD_GUILD_ID}/members/${discordUserId}`,
    {
      method:  'PUT',
      headers: botHeaders(),
      body:    JSON.stringify({ access_token: accessToken }),
    }
  )
  // 201 = added, 204 = already in guild
  return { ok: [201, 204].includes(res.status), status: res.status }
}

module.exports = {
  syncRoles,
  getOAuthURL,
  exchangeCode,
  getDiscordUser,
  addMemberToGuild,
  roleIdForPlan,
}
