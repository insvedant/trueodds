const ActivityLog = require('../models/ActivityLog');
const TYPE_CATEGORY = {
    signup: 'auth',
    login: 'auth',
    login_failed: 'auth',
    logout: 'auth',
    password_reset_requested: 'auth',
    password_reset_completed: 'auth',
    email_changed: 'auth',
    password_changed: 'auth',
    subscription_activated: 'subscription',
    trial_started: 'subscription',
    subscription_cancelled: 'subscription',
    subscription_upgraded: 'subscription',
    subscription_downgraded: 'subscription',
    payment_succeeded: 'subscription',
    payment_failed: 'subscription',
    discord_connected: 'discord',
    discord_disconnected: 'discord',
    discord_sync: 'discord',
    discord_sync_failed: 'discord',
    admin_settings_changed: 'admin',
    admin_social_updated: 'admin',
    admin_user_plan_changed: 'admin',
    admin_login: 'admin',
    cron_discord_alerts: 'system',
    ml_collect: 'system',
    ml_train: 'system',
    api_error: 'system',
};
async function logActivity({ type, user, email, ip, message, status = 'success', meta = {} }) {
    try {
        const category = TYPE_CATEGORY[type] || 'system';
        await ActivityLog.create({
            type,
            category,
            status,
            message: message || '',
            userId: user?._id || user?.id || null,
            email: user?.email || email || null,
            name: user?.name || null,
            role: user?.role || 'user',
            ip: ip || null,
            meta,
        });
    }
    catch (err) {
        console.warn('[ActivityLog] write failed:', err.message);
    }
}
module.exports = { logActivity };
