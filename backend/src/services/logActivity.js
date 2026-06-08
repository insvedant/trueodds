/**
 * TrueOdds — Activity Logger
 * Drop-in helper to write activity log entries from any route.
 * Fire-and-forget — never throws, never blocks a response.
 *
 * Usage:
 *   const { logActivity } = require('../services/logActivity')
 *   logActivity({ type:'login', category:'auth', user: req.user, ip: req.ip, message:'Logged in' })
 */

const ActivityLog = require('../models/ActivityLog')

// Category map so callers don't have to pass it manually
const TYPE_CATEGORY = {
  signup:                     'auth',
  login:                      'auth',
  login_failed:               'auth',
  logout:                     'auth',
  password_reset_requested:   'auth',
  password_reset_completed:   'auth',
  email_changed:              'auth',
  password_changed:           'auth',
  subscription_activated:     'subscription',
  subscription_cancelled:     'subscription',
  subscription_upgraded:      'subscription',
  subscription_downgraded:    'subscription',
  payment_succeeded:          'subscription',
  payment_failed:             'subscription',
  discord_connected:          'discord',
  discord_disconnected:       'discord',
  discord_sync:               'discord',
  discord_sync_failed:        'discord',
  admin_settings_changed:     'admin',
  admin_social_updated:       'admin',
  admin_user_plan_changed:    'admin',
  admin_login:                'admin',
  cron_discord_alerts:        'system',
  ml_collect:                 'system',
  ml_train:                   'system',
  api_error:                  'system',
}

/**
 * @param {object} opts
 * @param {string}        opts.type     — event type key from ActivityLog enum
 * @param {object}        [opts.user]   — user document or plain object { _id, email, name, role }
 * @param {string}        [opts.email]  — fallback if no user object
 * @param {string}        [opts.ip]     — req.ip
 * @param {string}        [opts.message]
 * @param {'success'|'failed'|'warning'} [opts.status]
 * @param {object}        [opts.meta]   — any extra context
 */
async function logActivity({ type, user, email, ip, message, status = 'success', meta = {} }) {
  try {
    const category = TYPE_CATEGORY[type] || 'system'
    await ActivityLog.create({
      type,
      category,
      status,
      message: message || '',
      userId: user?._id || user?.id || null,
      email:  user?.email || email || null,
      name:   user?.name  || null,
      role:   user?.role  || 'user',
      ip:     ip          || null,
      meta,
    })
  } catch (err) {
    // Never crash a request because of a logging failure
    console.warn('[ActivityLog] write failed:', err.message)
  }
}

module.exports = { logActivity }
