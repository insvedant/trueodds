const router = require('express').Router();
const { protect, requirePlan } = require('../middleware/auth');
const Bet = require('../models/Bet');
router.get('/', protect, requirePlan('gold','platinum'), async (req, res) => {
    try {
        const { sport, result, betType, limit = 50, skip = 0 } = req.query;
        const filter = { user: req.user._id };
        if (sport && sport !== 'All')
            filter.sport = sport;
        if (result)
            filter.result = result;
        if (betType)
            filter.betType = betType;
        const [bets, total] = await Promise.all([
            Bet.find(filter).sort({ date: -1 }).limit(+limit).skip(+skip),
            Bet.countDocuments(filter)
        ]);
        res.json({ success: true, bets, total });
    }
    catch (e) {
        res.status(500).json({ success: false, message: e.message });
    }
});
router.get('/stats', protect, requirePlan('gold','platinum'), async (req, res) => {
    try {
        const bets = await Bet.find({ user: req.user._id });
        const settled = bets.filter(b => b.result !== 'pending' && b.result !== 'void');
        const wins = bets.filter(b => b.result === 'win');
        const totalStake = settled.reduce((s, b) => s + b.stake, 0);
        const totalProfit = settled.reduce((s, b) => s + b.profit, 0);
        const bySport = {};
        bets.forEach(b => {
            if (!bySport[b.sport])
                bySport[b.sport] = { bets: 0, wins: 0, profit: 0, staked: 0 };
            bySport[b.sport].bets++;
            if (b.result === 'win')
                bySport[b.sport].wins++;
            bySport[b.sport].profit += b.profit;
            bySport[b.sport].staked += b.stake;
        });
        res.json({
            success: true,
            stats: {
                totalBets: bets.length, settledBets: settled.length,
                wins: wins.length, losses: bets.filter(b => b.result === 'loss').length,
                pending: bets.filter(b => b.result === 'pending').length,
                totalStake, totalProfit, roi: totalStake ? (totalProfit / totalStake * 100).toFixed(1) : 0,
                winRate: settled.length ? (wins.length / settled.length * 100).toFixed(1) : 0,
                bySport
            }
        });
    }
    catch (e) {
        res.status(500).json({ success: false, message: e.message });
    }
});
router.post('/', protect, requirePlan('gold','platinum'), async (req, res) => {
    try {
        const { game, sport, market, book, odds, stake, betType, notes, date } = req.body;
        if (!game || !market || !book || !odds || !stake)
            return res.status(400).json({ success: false, message: 'game, market, book, odds, stake required.' });
        const bet = await Bet.create({ user: req.user._id, game, sport: sport || 'Other', market, book, odds: +odds, stake: +stake, betType: betType || 'standard', notes, date: date ? new Date(date) : undefined });
        res.status(201).json({ success: true, bet });
    }
    catch (e) {
        res.status(500).json({ success: false, message: e.message });
    }
});
router.put('/:id', protect, requirePlan('gold','platinum'), async (req, res) => {
    try {
        const bet = await Bet.findOne({ _id: req.params.id, user: req.user._id });
        if (!bet)
            return res.status(404).json({ success: false, message: 'Bet not found.' });
        const allowed = ['game', 'sport', 'market', 'book', 'odds', 'stake', 'result', 'betType', 'notes', 'date'];
        allowed.forEach(k => { if (req.body[k] !== undefined)
            bet[k] = req.body[k]; });
        await bet.save();
        res.json({ success: true, bet });
    }
    catch (e) {
        res.status(500).json({ success: false, message: e.message });
    }
});
router.delete('/:id', protect, requirePlan('gold','platinum'), async (req, res) => {
    try {
        const bet = await Bet.findOneAndDelete({ _id: req.params.id, user: req.user._id });
        if (!bet)
            return res.status(404).json({ success: false, message: 'Bet not found.' });
        res.json({ success: true, message: 'Bet deleted.' });
    }
    catch (e) {
        res.status(500).json({ success: false, message: e.message });
    }
});
module.exports = router;
