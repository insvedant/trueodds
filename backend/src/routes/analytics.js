const router = require('express').Router();
const { protect, requirePlan } = require('../middleware/auth');
const Bet = require('../models/Bet');
router.get('/overview', protect, requirePlan('gold','platinum'), async (req, res) => {
    try {
        const { period = '30d' } = req.query;
        const days = period === '7d' ? 7 : period === '90d' ? 90 : 30;
        const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000);
        const bets = await Bet.find({ user: req.user._id, date: { $gte: since } });
        const allBets = await Bet.find({ user: req.user._id });
        const settled = allBets.filter(b => b.result !== 'pending');
        const wins = allBets.filter(b => b.result === 'win');
        const totalStake = settled.reduce((s, b) => s + b.stake, 0);
        const totalProfit = settled.reduce((s, b) => s + b.profit, 0);
        const dailyMap = {};
        bets.forEach(b => {
            const d = b.date.toISOString().split('T')[0];
            if (!dailyMap[d])
                dailyMap[d] = { date: d, profit: 0, bets: 0 };
            dailyMap[d].profit += b.profit;
            dailyMap[d].bets++;
        });
        const daily = Object.values(dailyMap).sort((a, b) => a.date.localeCompare(b.date));
        res.json({
            success: true,
            overview: {
                totalBets: allBets.length, settledBets: settled.length,
                wins: wins.length, losses: allBets.filter(b => b.result === 'loss').length,
                pending: allBets.filter(b => b.result === 'pending').length,
                totalStake, totalProfit,
                roi: totalStake ? +(totalProfit / totalStake * 100).toFixed(1) : 0,
                winRate: settled.length ? +(wins.length / settled.length * 100).toFixed(1) : 0,
            },
            daily, period
        });
    }
    catch (e) {
        res.status(500).json({ success: false, message: e.message });
    }
});
module.exports = router;
