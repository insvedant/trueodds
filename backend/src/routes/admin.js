const router = require('express').Router();
const { protect, adminOnly } = require('../middleware/auth');
const User = require('../models/User');
const Bet = require('../models/Bet');
const ActivityLog = require('../models/ActivityLog');
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
        const totalRevenue = users.reduce((s, u) => s + (u.totalPaid || 0), 0);
        const monthlyPayments = users.flatMap(u => u.payments.filter(p => new Date(p.date) >= startOfMonth));
        const monthlyRevenue = monthlyPayments.reduce((s, p) => s + (p.amount || 0), 0);
        const lastMonthStart = new Date(now.getFullYear(), now.getMonth() - 1, 1);
        const lastMonthEnd = new Date(now.getFullYear(), now.getMonth(), 1);
        const lastMonthPayments = users.flatMap(u => u.payments.filter(p => new Date(p.date) >= lastMonthStart && new Date(p.date) < lastMonthEnd));
        const lastMonthRevenue = lastMonthPayments.reduce((s, p) => s + (p.amount || 0), 0);
        const planCounts = users.reduce((acc, u) => { acc[u.plan] = (acc[u.plan] || 0) + 1; return acc; }, {});
        const totalStaked = bets.reduce((s, b) => s + b.stake, 0);
        const totalProfit = bets.reduce((s, b) => s + b.profit, 0);
        res.json({ success: true, stats: { totalUsers, activeUsers, newThisMonth, totalRevenue, monthlyRevenue, lastMonthRevenue, planCounts, totalBets, totalStaked, totalProfit } });
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
        const allowed = ['plan', 'subscriptionStatus', 'isActive', 'role'];
        allowed.forEach(k => { if (req.body[k] !== undefined)
            user[k] = req.body[k]; });
        await user.save({ validateBeforeSave: false });
        res.json({ success: true, user: user.toPublicJSON() });
    }
    catch (e) {
        res.status(500).json({ success: false, message: e.message });
    }
});
router.delete('/users/:id', async (req, res) => {
    try {
        if (req.params.id === req.user._id.toString())
            return res.status(400).json({ success: false, message: 'Cannot delete yourself.' });
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
        const byPlan = { gold: 0, platinum: 0 };
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
            const m = new Date(p.date).toLocaleString('en-US', { month: 'short', year: '2-digit' });
            monthlyMap[m] = (monthlyMap[m] || 0) + (p.amount || 0);
        }
        const monthly = Object.entries(monthlyMap)
            .map(([month, revenue]) => ({ month, revenue }))
            .slice(-12);
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
                const m = new Date(p.date).toLocaleString('en-US', { month: 'short', year: '2-digit' });
                monthlyMap[m] = (monthlyMap[m] || 0) + (p.amount || 0);
            }
        }
        const monthly = Object.entries(monthlyMap)
            .map(([month, revenue]) => ({ month, revenue: Math.round(revenue * 100) / 100 }))
            .slice(-12);
        res.json({ success: true, monthly });
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
