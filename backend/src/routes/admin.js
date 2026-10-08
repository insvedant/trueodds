const router = require('express').Router();
const { protect, adminOnly } = require('../middleware/auth');
const User = require('../models/User');
const Bet = require('../models/Bet');
const ActivityLog = require('../models/ActivityLog');
const StripeStatus = require('../models/StripeStatus');
const { runStripeSync } = require('../services/stripeScheduler');
const { cancelSubscriptionSafe, isStripeConfigured, isWebhookConfigured } = require('../services/stripeService');
const ledger = require('../services/stripeLedger');
const { logActivity } = require('../services/logActivity');
router.use(protect, adminOnly);
router.get('/overview', async (req, res) => {
    try {
        const [totalUsers, activeUsers, totalBets, bets, users] = await Promise.all([
            User.countDocuments(),
            User.countDocuments({ subscriptionStatus: 'active' }),
            Bet.countDocuments(),
            Bet.find(),
            User.find()
        ]);
        const now = new Date(), startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
        const newThisMonth = users.filter(u => u.createdAt >= startOfMonth).length;
        // Revenue is derived from the recorded successful payment ledger.
        // totalPaid is kept for user-level display, but summing the payment
        // records prevents stale aggregate values from hiding real payments.
        const allPayments = users.flatMap(u => (u.payments || []).map(p => ({
            ...p.toObject(),
            userName: u.name,
            userEmail: u.email,
            userPlan: u.plan,
        })));
        const totalRevenue = allPayments.reduce((s, p) => s + (Number(p.amount) || 0), 0);
        const monthlyPayments = allPayments.filter(p => p.date && new Date(p.date) >= startOfMonth);
        const monthlyRevenue = monthlyPayments.reduce((s, p) => s + (p.amount || 0), 0);
        const lastMonthStart = new Date(now.getFullYear(), now.getMonth() - 1, 1);
        const lastMonthEnd = new Date(now.getFullYear(), now.getMonth(), 1);
        const lastMonthPayments = users.flatMap(u => (u.payments || []).filter(p => new Date(p.date) >= lastMonthStart && new Date(p.date) < lastMonthEnd));
        const lastMonthRevenue = lastMonthPayments.reduce((s, p) => s + (p.amount || 0), 0);
        const planCounts = users.reduce((acc, u) => { acc[u.plan] = (acc[u.plan] || 0) + 1; return acc; }, {});
        const latestPayment = allPayments
            .filter(p => p.date)
            .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())[0] || null;
        const totalStaked = bets.reduce((s, b) => s + b.stake, 0);
        const totalProfit = bets.reduce((s, b) => s + b.profit, 0);
        res.json({ success: true, stats: {
            totalUsers,
            activeUsers,
            newThisMonth,
            totalRevenue,
            monthlyRevenue,
            lastMonthRevenue,
            planCounts,
            totalBets,
            totalStaked,
            totalProfit,
            latestPlan: latestPayment?.plan || latestPayment?.userPlan || null,
            latestPayment: latestPayment ? {
                amount: latestPayment.amount,
                plan: latestPayment.plan || latestPayment.userPlan,
                userName: latestPayment.userName,
                userEmail: latestPayment.userEmail,
                date: latestPayment.date,
            } : null,
        } });
    }
    catch (e) {
        res.status(500).json({ success: false, message: e.message });
    }
});
router.get('/users', async (req, res) => {
    try {
        const { search, plan, limit = 20, skip = 0 } = req.query;
        const filter = {};
        if (search)
            filter.$or = [{ name: { $regex: search, $options: 'i' } }, { email: { $regex: search, $options: 'i' } }];
        if (plan)
            filter.plan = plan;
        const [users, total] = await Promise.all([
            User.find(filter).sort({ createdAt: -1 }).limit(+limit).skip(+skip).lean(),
            User.countDocuments(filter)
        ]);
        const betStats = await Bet.aggregate([
            { $group: { _id: '$user', total: { $sum: 1 }, wins: { $sum: { $cond: [{ $eq: ['$result', 'win'] }, 1, 0] } }, profit: { $sum: '$profit' } } }
        ]);
        const statsMap = Object.fromEntries(betStats.map(s => [s._id.toString(), s]));
        const enriched = users.map(u => ({ ...u, betStats: statsMap[u._id.toString()] || { total: 0, wins: 0, profit: 0 } }));
        res.json({ success: true, users: enriched, total });
    }
    catch (e) {
        res.status(500).json({ success: false, message: e.message });
    }
});
router.get('/users/:id', async (req, res) => {
    try {
        const user = await User.findById(req.params.id);
        if (!user)
            return res.status(404).json({ success: false, message: 'User not found.' });
        const bets = await Bet.find({ user: req.params.id }).sort({ date: -1 }).limit(10);
        res.json({ success: true, user, bets });
    }
    catch (e) {
        res.status(500).json({ success: false, message: e.message });
    }
});
router.put('/users/:id', async (req, res) => {
    try {
        const user = await User.findById(req.params.id);
        if (!user)
            return res.status(404).json({ success: false, message: 'User not found.' });
        const { plan, subscriptionStatus, isActive, role } = req.body;
        const VALID_PLANS = ['free', 'basic', 'gold', 'platinum'];
        const VALID_STATUS = ['active', 'inactive', 'cancelled', 'trial', 'past_due'];
        if (plan !== undefined && !VALID_PLANS.includes(plan))
            return res.status(400).json({ success: false, message: 'Invalid plan.' });
        if (subscriptionStatus !== undefined && !VALID_STATUS.includes(subscriptionStatus))
            return res.status(400).json({ success: false, message: 'Invalid status.' });
        if (role !== undefined && !['user', 'admin'].includes(role))
            return res.status(400).json({ success: false, message: 'Invalid role.' });

        const before = { plan: user.plan, status: user.subscriptionStatus };
        const isStop = (s) => s === 'cancelled' || s === 'inactive';
        // "Stop billing" = the admin moves the user to Cancelled/Inactive, or
        // removes their plan. Judged on what CHANGED, so re-saving an
        // unrelated field (the form always sends plan + status) can't cancel
        // anyone by accident.
        const stopRequested =
            (subscriptionStatus !== undefined && isStop(subscriptionStatus) && !isStop(user.subscriptionStatus)) ||
            (plan === 'free' && user.plan !== 'free');
        const warnings = [];
        let stripeCancelled = false;

        if (stopRequested && user.stripeSubscriptionId) {
            // This used to only edit the MongoDB record, so the Stripe
            // subscription kept billing the customer after an admin
            // "cancelled" them. Cancel in Stripe FIRST and only record the
            // cancellation if Stripe confirms it; if Stripe refuses, save
            // nothing so the panel never claims a customer is cancelled while
            // they are still being charged.
            const subscriptionId = user.stripeSubscriptionId;
            let result;
            try {
                result = await cancelSubscriptionSafe(subscriptionId);
            }
            catch (err) {
                console.error('[Admin] Stripe cancel failed:', err.message);
                return res.status(502).json({
                    success: false,
                    message: `Stripe could not cancel this subscription (${err.message}). Nothing was changed, so the customer is NOT marked cancelled. Cancel it in the Stripe dashboard, then run Sync Stripe.`,
                });
            }
            const ended = result.subscription || { id: subscriptionId, status: 'canceled', customer: user.stripeCustomerId };
            await ledger.applySubscriptionEnded(user, ended, { by: 'admin' });
            stripeCancelled = true;
        }
        else {
            if (plan !== undefined) user.plan = plan;
            if (subscriptionStatus !== undefined) user.subscriptionStatus = subscriptionStatus;
            const changedBilling = user.plan !== before.plan || user.subscriptionStatus !== before.status;
            if (user.stripeSubscriptionId && changedBilling) {
                // Stripe owns plan/status for anyone it bills; the periodic
                // sync restores Stripe's values. Say so rather than letting
                // the admin believe an edit stuck.
                warnings.push('This customer is billed through Stripe, and Stripe is the source of truth for plan and status — this edit will be reverted by the next Stripe sync (every 15 min). To change what they are charged, change their subscription in the Stripe dashboard.');
            }
        }
        if (isActive !== undefined) user.isActive = !!isActive;
        if (role !== undefined) user.role = role;
        await user.save({ validateBeforeSave: false });

        if (user.plan !== before.plan || user.subscriptionStatus !== before.status) {
            logActivity({
                type: 'admin_user_plan_changed',
                user,
                ip: req.ip,
                message: `${req.user.email} changed ${user.email}: plan ${before.plan} → ${user.plan}, status ${before.status} → ${user.subscriptionStatus}${stripeCancelled ? ' (Stripe subscription cancelled)' : ''}`,
                meta: { before, after: { plan: user.plan, status: user.subscriptionStatus }, stripeCancelled, adminId: req.user._id },
            });
        }
        res.json({
            success: true,
            user: user.toPublicJSON(),
            stripeCancelled,
            warnings,
            message: stripeCancelled ? 'Stripe subscription cancelled — the customer will not be billed again.' : 'User updated.',
        });
    }
    catch (e) {
        res.status(500).json({ success: false, message: e.message });
    }
});
router.delete('/users/:id', async (req, res) => {
    try {
        if (req.params.id === req.user._id.toString())
            return res.status(400).json({ success: false, message: 'Cannot delete yourself.' });
        const user = await User.findById(req.params.id);
        if (!user)
            return res.status(404).json({ success: false, message: 'User not found.' });
        if (user.stripeSubscriptionId) {
            // Deleting the account without cancelling the subscription would
            // leave an orphaned Stripe subscription charging a customer who
            // no longer has an account.
            try {
                await cancelSubscriptionSafe(user.stripeSubscriptionId);
            }
            catch (err) {
                console.error('[Admin] Stripe cancel before delete failed:', err.message);
                return res.status(502).json({
                    success: false,
                    message: `Stripe could not cancel this user's subscription (${err.message}), so the user was NOT deleted — otherwise they would keep being billed with no account. Cancel it in Stripe first.`,
                });
            }
        }
        await User.findByIdAndDelete(req.params.id);
        await Bet.deleteMany({ user: req.params.id });
        res.json({ success: true, message: 'User deleted.' });
    }
    catch (e) {
        res.status(500).json({ success: false, message: e.message });
    }
});
router.get('/revenue', async (req, res) => {
    try {
        const users = await User.find();
        const totalRevenue = users.reduce((s, u) => s + (u.totalPaid || 0), 0);
        const byPlan = { basic: 0, gold: 0, platinum: 0 };
        users.forEach(u => u.payments.forEach(p => { if (byPlan[p.plan] !== undefined)
            byPlan[p.plan] += p.amount || 0; }));
        const recentPayments = users.flatMap(u => u.payments.map(p => ({ ...p.toObject(), userName: u.name, userEmail: u.email }))).sort((a, b) => new Date(b.date) - new Date(a.date)).slice(0, 50);
        res.json({ success: true, totalRevenue, byPlan, recentPayments });
    }
    catch (e) {
        res.status(500).json({ success: false, message: e.message });
    }
});
router.get('/bets', async (req, res) => {
    try {
        const bets = await Bet.find().sort({ date: -1 }).limit(200).populate('user', 'name email plan');
        const totalStaked = bets.reduce((s, b) => s + b.stake, 0);
        const totalProfit = bets.reduce((s, b) => s + b.profit, 0);
        res.json({ success: true, bets, totalStaked, totalProfit });
    }
    catch (e) {
        res.status(500).json({ success: false, message: e.message });
    }
});
module.exports = router;
router.get('/payments', async (req, res) => {
    try {
        const { period = 'all' } = req.query;
        const users = await User.find({ 'payments.0': { $exists: true } }).lean();
        let since = null;
        if (period === '30d')
            since = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
        if (period === '7d')
            since = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
        const payments = [];
        for (const user of users) {
            for (const p of user.payments || []) {
                if (since && new Date(p.date) < since)
                    continue;
                payments.push({
                    userName: user.name,
                    userEmail: user.email,
                    plan: p.plan || user.plan,
                    amount: p.amount,
                    date: p.date,
                    stripeInvoiceId: p.stripeInvoiceId,
                    status: p.status || 'completed',
                });
            }
        }
        payments.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
        const monthlyMap = {};
        for (const p of payments) {
            if (!p.date) continue;
            const d = new Date(p.date);
            const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
            monthlyMap[key] = (monthlyMap[key] || 0) + (p.amount || 0);
        }
        const monthly = Object.entries(monthlyMap)
            .sort(([a], [b]) => a.localeCompare(b))
            .slice(-12)
            .map(([key, revenue]) => {
                const [year, month] = key.split('-').map(Number);
                const label = new Date(year, month - 1, 1).toLocaleString('en-US', { month: 'short', year: '2-digit' });
                return { month: label, revenue: Math.round(revenue * 100) / 100 };
            });
        res.json({ success: true, payments, monthly });
    }
    catch (e) {
        res.status(500).json({ success: false, message: e.message });
    }
});
router.get('/revenue/monthly', async (req, res) => {
    try {
        const users = await User.find({ 'payments.0': { $exists: true } }).lean();
        const monthlyMap = {};
        for (const user of users) {
            for (const p of user.payments || []) {
                if (!p.date) continue;
                const d = new Date(p.date);
                const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
                monthlyMap[key] = (monthlyMap[key] || 0) + (p.amount || 0);
            }
        }
        const monthly = Object.entries(monthlyMap)
            .sort(([a], [b]) => a.localeCompare(b))
            .slice(-12)
            .map(([key, revenue]) => {
                const [year, month] = key.split('-').map(Number);
                const label = new Date(year, month - 1, 1).toLocaleString('en-US', { month: 'short', year: '2-digit' });
                return { month: label, revenue: Math.round(revenue * 100) / 100 };
            });
        res.json({ success: true, monthly });
    }
    catch (e) {
        res.status(500).json({ success: false, message: e.message });
    }
});

// POST /api/admin/stripe-sync — full reconcile of Stripe into MongoDB
// (all paid invoices + all subscriptions). Safe to run repeatedly: invoice ids
// are the idempotency key. The same sync also runs automatically every 15 min.
router.post('/stripe-sync', async (req, res) => {
    try {
        const result = await runStripeSync({ source: 'manual' });
        if (result.skipped) {
            return res.status(409).json({ success: false, message: `Sync not started: ${result.reason}. Try again in a minute.` });
        }
        res.json({
            success: true,
            message: 'Stripe data synchronized successfully.',
            result,
        });
    } catch (e) {
        console.error('[Stripe Sync] failed:', e);
        res.status(500).json({
            success: false,
            message: e.message,
        });
    }
});

// GET /api/admin/stripe-status — is the Stripe integration actually working?
router.get('/stripe-status', async (req, res) => {
    try {
        const now = new Date();
        const [status, staleTrials, billedUsers] = await Promise.all([
            StripeStatus.getSingleton(),
            // Trials whose end date has passed but that we still show as
            // "trial" — each one is a customer Stripe has likely already
            // charged (or lost) that the panel hasn't caught up with.
            User.countDocuments({ subscriptionStatus: 'trial', stripeSubscriptionId: { $exists: true, $ne: null }, trialEndsAt: { $lt: now } }),
            User.countDocuments({ stripeSubscriptionId: { $exists: true, $ne: null } }),
        ]);
        res.json({
            success: true,
            stripeKeyConfigured: isStripeConfigured(),
            webhookSecretConfigured: isWebhookConfigured(),
            webhookUrl: `${req.protocol}://${req.get('host')}/api/webhook/stripe`,
            autoSync: {
                enabled: String(process.env.STRIPE_AUTO_SYNC).toLowerCase() !== 'false',
                intervalMinutes: Math.max(1, Number(process.env.STRIPE_SYNC_INTERVAL_MIN) || 15),
            },
            status: {
                lastWebhookAt: status.lastWebhookAt || null,
                lastWebhookType: status.lastWebhookType || null,
                webhookCount: status.webhookCount || 0,
                lastWebhookError: status.lastWebhookError || null,
                lastWebhookErrorAt: status.lastWebhookErrorAt || null,
                lastSyncAt: status.lastSyncAt || null,
                lastSyncSource: status.lastSyncSource || null,
                lastSyncResult: status.lastSyncResult || null,
                lastSyncError: status.lastSyncError || null,
                lastSyncErrorAt: status.lastSyncErrorAt || null,
            },
            staleTrials,
            billedUsers,
        });
    }
    catch (e) {
        res.status(500).json({ success: false, message: e.message });
    }
});

// GET /api/admin/logs — general activity log viewer (already referenced by
// the existing admin Logs page in the frontend, but this endpoint never
// actually existed on the backend until now — that page has been silently
// broken/empty this whole time).
router.get('/logs', async (req, res) => {
    try {
        const { page = 1, limit = 50, category, status, search } = req.query;
        const filter = {};
        if (category && category !== 'all') filter.category = category;
        if (status && status !== 'all') filter.status = status;
        if (search) {
            filter.$or = [
                { email: { $regex: search, $options: 'i' } },
                { name: { $regex: search, $options: 'i' } },
                { message: { $regex: search, $options: 'i' } },
            ];
        }
        const skip = (parseInt(page) - 1) * parseInt(limit);
        const [logs, total] = await Promise.all([
            ActivityLog.find(filter).sort({ createdAt: -1 }).skip(skip).limit(parseInt(limit)),
            ActivityLog.countDocuments(filter),
        ]);
        res.json({ success: true, logs, total, totalPages: Math.max(1, Math.ceil(total / parseInt(limit))) });
    }
    catch (e) {
        res.status(500).json({ success: false, message: e.message });
    }
});

// GET /api/admin/subscription-activity — dedicated feed for subscription
// lifecycle events only (new subscriptions, trial conversions, payment
// failures, cancellations) — same underlying ActivityLog data as /logs,
// pre-filtered to category:'subscription' plus a few summary counts.
router.get('/subscription-activity', async (req, res) => {
    try {
        const { page = 1, limit = 50, type, search } = req.query;
        const filter = { category: 'subscription' };
        if (type && type !== 'all') filter.type = type;
        if (search) {
            filter.$or = [
                { email: { $regex: search, $options: 'i' } },
                { name: { $regex: search, $options: 'i' } },
            ];
        }
        const skip = (parseInt(page) - 1) * parseInt(limit);
        const [logs, total, counts] = await Promise.all([
            ActivityLog.find(filter).sort({ createdAt: -1 }).skip(skip).limit(parseInt(limit)),
            ActivityLog.countDocuments(filter),
            ActivityLog.aggregate([
                { $match: { category: 'subscription' } },
                { $group: { _id: '$type', count: { $sum: 1 } } },
            ]),
        ]);
        const countsByType = Object.fromEntries(counts.map(c => [c._id, c.count]));
        res.json({
            success: true,
            logs,
            total,
            totalPages: Math.max(1, Math.ceil(total / parseInt(limit))),
            countsByType,
        });
    }
    catch (e) {
        res.status(500).json({ success: false, message: e.message });
    }
});
