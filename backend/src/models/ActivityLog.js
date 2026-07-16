const mongoose = require('mongoose');
const activityLogSchema = new mongoose.Schema({
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
    email: { type: String, default: null },
    name: { type: String, default: null },
    role: { type: String, default: 'user' },
    type: {
        type: String,
        required: true,
        enum: [
            'signup', 'login', 'login_failed', 'logout',
            'password_reset_requested', 'password_reset_completed',
            'email_changed', 'password_changed',
            'subscription_activated', 'subscription_cancelled',
            'subscription_upgraded', 'subscription_downgraded',
            'trial_started',
            'payment_succeeded', 'payment_failed',
            'discord_connected', 'discord_disconnected', 'discord_sync',
            'discord_sync_failed',
            'admin_settings_changed', 'admin_social_updated',
            'admin_user_plan_changed', 'admin_login',
            'cron_discord_alerts', 'ml_collect', 'ml_train',
            'api_error',
        ],
    },
    category: {
        type: String,
        enum: ['auth', 'subscription', 'discord', 'admin', 'system'],
        required: true,
    },
    status: { type: String, enum: ['success', 'failed', 'warning'], default: 'success' },
    message: { type: String, default: '' },
    ip: { type: String, default: null },
    meta: { type: mongoose.Schema.Types.Mixed, default: {} },
    createdAt: { type: Date, default: Date.now },
}, {
    timestamps: false,
    collection: 'activity_logs',
});
activityLogSchema.index({ createdAt: 1 }, { expireAfterSeconds: 90 * 24 * 60 * 60 });
activityLogSchema.index({ type: 1, createdAt: -1 });
activityLogSchema.index({ userId: 1, createdAt: -1 });
activityLogSchema.index({ category: 1, createdAt: -1 });
activityLogSchema.index({ status: 1, createdAt: -1 });
module.exports = mongoose.models.ActivityLog || mongoose.model('ActivityLog', activityLogSchema);
