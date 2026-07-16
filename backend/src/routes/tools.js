const router = require('express').Router();
const { protect, requirePlan } = require('../middleware/auth');
const { getMiddles, getBookRankings, getKeyNumberWatch, getNoVig, getQuotaInfo, } = require('../services/apiService');
const { getLineMovementSeries, getClosingSnapshot, findOutcomeInSnapshot, americanToDecimal, getSteamMoves, } = require('../services/lineMovementService');
const Bet = require('../models/Bet');
// Plan gating matrix for these tools:
//   Middles              — Gold + Platinum
//   Total Line Movement  — Gold + Platinum
//   Spread Steam Detect. — Platinum only
//   CLV Tracking         — Platinum only
//   No-Vig Fair Odds     — Basic + Gold + Platinum
//   Key Number Watch     — Gold + Platinum
//   Sportsbook Rankings  — Basic + Gold + Platinum
router.get('/middles', protect, requirePlan('gold', 'platinum'), async (req, res) => {
    try {
        const { minGap = 1, sport } = req.query;
        const { data, source } = await getMiddles(parseFloat(minGap), sport || null);
        res.json({ success: true, source, count: data.length, data, quota: getQuotaInfo() });
    }
    catch (err) {
        console.error('Middles route error:', err.message);
        res.status(500).json({ success: false, message: err.message });
    }
});
router.get('/book-rankings', protect, requirePlan('basic', 'gold', 'platinum'), async (req, res) => {
    try {
        const { data, source } = await getBookRankings();
        res.json({ success: true, source, count: data.length, data });
    }
    catch (err) {
        console.error('Book rankings route error:', err.message);
        res.status(500).json({ success: false, message: err.message });
    }
});
router.get('/key-numbers', protect, requirePlan('gold', 'platinum'), async (req, res) => {
    try {
        const { sport } = req.query;
        const { data, source } = await getKeyNumberWatch(sport || null);
        res.json({ success: true, count: data.length, data });
    }
    catch (err) {
        console.error('Key numbers route error:', err.message);
        res.status(500).json({ success: false, message: err.message });
    }
});
router.get('/no-vig', protect, requirePlan('basic', 'gold', 'platinum'), async (req, res) => {
    try {
        const { sport } = req.query;
        const { data, source } = await getNoVig(sport || null);
        res.json({ success: true, count: data.length, data });
    }
    catch (err) {
        console.error('No-vig route error:', err.message);
        res.status(500).json({ success: false, message: err.message });
    }
});
router.get('/line-movement', protect, requirePlan('gold', 'platinum'), async (req, res) => {
    try {
        const { eventId, market = 'spreads', selection } = req.query;
        if (!eventId)
            return res.status(400).json({ success: false, message: 'eventId is required.' });
        const result = await getLineMovementSeries(eventId, market, selection || null);
        if (!result.available) {
            return res.json({ success: true, offline: true, message: 'Line movement database is not configured (ML_MONGODB_URI missing).', data: {} });
        }
        res.json({ success: true, snapshotCount: result.snapshotCount || 0, data: result.byBookSelection || {} });
    }
    catch (err) {
        console.error('Line movement route error:', err.message);
        res.status(500).json({ success: false, message: err.message });
    }
});
router.get('/steam', protect, requirePlan('platinum'), async (req, res) => {
    try {
        const { windowMinutes = 15, sport } = req.query;
        const result = await getSteamMoves(parseFloat(windowMinutes), sport || null);
        if (!result.available) {
            return res.json({ success: true, offline: true, message: 'Steam detection database is not configured (ML_MONGODB_URI missing).', data: [] });
        }
        res.json({ success: true, count: result.data.length, data: result.data });
    }
    catch (err) {
        console.error('Steam route error:', err.message);
        res.status(500).json({ success: false, message: err.message });
    }
});
router.get('/clv', protect, requirePlan('platinum'), async (req, res) => {
    try {
        const bets = await Bet.find({ user: req.user._id, eventId: { $ne: null }, selection: { $ne: null } })
            .sort({ date: -1 }).limit(100);
        const totalBetsLogged = await Bet.countDocuments({ user: req.user._id });
        const results = [];
        for (const bet of bets) {
            const closing = await getClosingSnapshot(bet.eventId);
            const outcome = findOutcomeInSnapshot(closing, bet.market, bet.selection, bet.book);
            if (!outcome)
                continue;
            const betDec = americanToDecimal(bet.odds);
            const closeDec = americanToDecimal(outcome.price);
            const betProb = 1 / betDec;
            const closeProb = 1 / closeDec;
            const clvPct = (closeProb - betProb) * 100;
            results.push({
                betId: bet._id,
                game: bet.game,
                sport: bet.sport,
                market: bet.market,
                selection: bet.selection,
                betOdds: bet.odds,
                betPoint: bet.point,
                closingOdds: outcome.price,
                closingPoint: outcome.point,
                closingBook: outcome.book,
                clvPct: Math.round(clvPct * 100) / 100,
                beatClose: clvPct > 0,
                date: bet.date,
            });
        }
        const avgClv = results.length
            ? Math.round((results.reduce((s, r) => s + r.clvPct, 0) / results.length) * 100) / 100
            : null;
        res.json({
            success: true,
            data: results,
            summary: {
                betsWithClv: results.length,
                totalBetsLogged,
                avgClvPct: avgClv,
                beatCloseRate: results.length ? Math.round((results.filter(r => r.beatClose).length / results.length) * 1000) / 10 : null,
            },
        });
    }
    catch (err) {
        console.error('CLV route error:', err.message);
        res.status(500).json({ success: false, message: err.message });
    }
});
module.exports = router;
