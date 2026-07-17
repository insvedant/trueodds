const router = require('express').Router();
const { protect, requirePlan } = require('../middleware/auth');
const { mlCollection } = require('../services/mlDb');
const ML_API = process.env.ML_API_URL || 'http://localhost:8000';
async function mlFetch(path, options = {}) {
    try {
        const res = await fetch(`${ML_API}${path}`, {
            ...options,
            headers: { 'Content-Type': 'application/json', ...options.headers },
            signal: AbortSignal.timeout(5000),
        });
        if (!res.ok)
            throw new Error(`ML API error: ${res.status}`);
        return await res.json();
    }
    catch (err) {
        return { available: false, reason: err.message, offline: true };
    }
}
router.get('/health', async (req, res) => {
    try {
        const health = await mlFetch('/health');
        const withTimeout = (p, ms = 4000) => Promise.race([p, new Promise(r => setTimeout(() => r(0), ms))]);
        const [snapCol, predCol, lineCol, arbCol] = await Promise.all([
            mlCollection('odds_snapshots'), mlCollection('ml_predictions'),
            mlCollection('line_movements'), mlCollection('arb_history'),
        ]);
        const [snapshots, predictions, lineMovs, arbHistory] = await Promise.all([
            snapCol ? withTimeout(snapCol.countDocuments()) : 0,
            predCol ? withTimeout(predCol.countDocuments()) : 0,
            lineCol ? withTimeout(lineCol.countDocuments()) : 0,
            arbCol ? withTimeout(arbCol.countDocuments()) : 0,
        ]);
        res.json({
            success: true,
            ml_service: health.offline ? 'offline' : 'online',
            data_pipeline: {
                odds_snapshots: snapshots,
                predictions: predictions,
                line_movements: lineMovs,
                arb_history: arbHistory,
                ready_for_ml: snapshots >= 500,
                status: snapshots < 100 ? 'collecting'
                    : snapshots < 500 ? 'building'
                        : 'ready',
            },
            ml_health: health,
        });
    }
    catch (err) {
        res.json({ success: false, message: err.message });
    }
});
router.get('/predictions/batch', protect, async (req, res) => {
    try {
        const col = await mlCollection('ml_predictions');
        if (!col)
            return res.json({ success: true, count: 0, predictions: [], offline: true });
        const now = new Date();
        const ago = new Date(now - 48 * 60 * 60 * 1000);
        const predictions = await col
            .find({ generated_at: { $gte: ago.toISOString() } }, { projection: { _id: 0 } })
            .sort({ generated_at: -1 })
            .limit(20)
            .toArray();
        const final = predictions.length > 0 ? predictions :
            await col
                .find({}, { projection: { _id: 0 } })
                .sort({ generated_at: -1 })
                .limit(20)
                .toArray();
        res.json({ success: true, count: final.length, predictions: final });
    }
    catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
});
router.get('/predictions/:eventId', protect, async (req, res) => {
    try {
        const col = await mlCollection('ml_predictions');
        const pred = col ? await col.findOne({ event_id: req.params.eventId }, { projection: { _id: 0 } }) : null;
        if (pred) {
            return res.json({ success: true, source: 'cache', prediction: pred });
        }
        const live = await mlFetch(`/predictions/${req.params.eventId}`);
        res.json({ success: true, source: 'live', prediction: live });
    }
    catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
});
router.get('/sharp-money', protect, async (req, res) => {
    try {
        const data = await mlFetch('/sharp-money');
        if (!data.offline && data.count > 0) {
            return res.json({ success: true, ...data });
        }
        const apiService = require('../services/apiService');
        const { data: allOdds } = await apiService.getAllOdds().catch(() => ({ data: [] }));
        const events = [];
        for (const game of (allOdds || []).slice(0, 30)) {
            const mkt = (game.markets || [])[0];
            const rows = mkt?.rows || [];
            if (rows.length < 2)
                continue;
            for (const row of rows) {
                const best = parseInt(String(row.bestOdds || '0').replace('+', ''));
                const avg = parseInt(String(row.avgOdds || '0').replace('+', ''));
                if (!best || !avg)
                    continue;
                const toProb = o => o > 0 ? 100 / (o + 100) : Math.abs(o) / (Math.abs(o) + 100);
                const probDiff = Math.abs(toProb(best) - toProb(avg));
                if (probDiff < 0.02)
                    continue;
                const direction = best > avg ? 'up' : 'down';
                const movement = best - avg;
                const projected = best + Math.round(movement * 0.6);
                const projStr = projected > 0 ? `+${projected}` : String(projected);
                const currentStr = best > 0 ? `+${best}` : String(best);
                const bookCount = Object.keys(row.books || {}).length;
                const accuracy = Math.min(78, 52 + bookCount * 4);
                const urgencyMinutes = probDiff > 0.06 ? 15 : probDiff > 0.04 ? 30 : 60;
                events.push({
                    event_id: `${game.id}_${row.selection}`,
                    sport: game.sport || '',
                    game: game.game || '',
                    home: game.game?.split(' vs ')[0] || '',
                    away: game.game?.split(' vs ')[1] || '',
                    market: mkt?.name || 'Moneyline',
                    selection: row.selection,
                    generated_at: new Date().toISOString(),
                    sharp_money: {
                        available: true,
                        is_sharp: true,
                        probability: parseFloat((0.52 + probDiff * 8).toFixed(3)),
                        signal_strength: probDiff > 0.06 ? 'strong' : probDiff > 0.04 ? 'moderate' : 'weak',
                        direction,
                        from_line: currentStr,
                        to_line: projStr,
                        accuracy,
                        urgency_minutes: urgencyMinutes,
                    },
                });
            }
        }
        events.sort((a, b) => b.sharp_money.probability - a.sharp_money.probability);
        const top = events.slice(0, 20);
        res.json({ success: true, count: top.length, events: top, source: 'live_fallback' });
    }
    catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
});
router.get('/arb-windows', protect, async (req, res) => {
    try {
        const data = await mlFetch('/arb-windows');
        if (!data.offline && data.count > 0) {
            return res.json({ success: true, ...data });
        }
        const apiService = require('../services/apiService');
        const { data: allArbs } = await apiService.getArbitrage(0.5, null).catch(() => ({ data: [] }));
        const arbs = (allArbs || []).slice(0, 20).map((a, i) => {
            const profit = a.profit || 0;
            const urgency = profit >= 4 ? 'critical' : profit >= 2.5 ? 'high' : profit >= 1.5 ? 'medium' : 'low';
            const probMap = { critical: 88, high: 72, medium: 55, low: 38 };
            const timeMap = { critical: 'Now', high: '5–15 min', medium: '15–45 min', low: '45–90 min' };
            const legs = a.legs || [];
            const books = legs.map(l => (l.book || '').replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase()));
            return {
                event_id: a.id || String(i),
                game: a.game || '',
                sport: (a.sport || '').replace(/.*_/, '').toUpperCase(),
                market: a.market || 'Moneyline',
                profit_pct: profit,
                legs,
                books: books.slice(0, 2),
                probability: probMap[urgency],
                expectedIn: timeMap[urgency],
                prepTip: books.length >= 2
                    ? `Have accounts funded at ${books.slice(0, 2).join(' & ')}. Place both legs simultaneously.`
                    : 'Prepare accounts at both books. Act within 60s of spotting the window.',
                window: { urgency, available: true },
            };
        });
        res.json({ success: true, count: arbs.length, arbs, source: 'live_fallback' });
    }
    catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
});
router.post('/score-ev', protect, requirePlan('platinum'), async (req, res) => {
    try {
        const data = await mlFetch('/predict/ev', {
            method: 'POST',
            body: JSON.stringify(req.body),
        });
        res.json({ success: true, ...data });
    }
    catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
});
router.get('/insights', protect, async (req, res) => {
    try {
        const uid = req.user._id.toString();
        const mlData = await mlFetch(`/insights/${uid}`);
        if (!mlData.offline && mlData.available !== false) {
            return res.json({ success: true, ...mlData });
        }
        const Bet = require('../models/Bet');
        const bets = await Bet.find({ user: req.user._id }).lean();
        const settled = bets.filter(b => b.result !== 'pending');
        const wins = settled.filter(b => b.result === 'win');
        const totalStake = settled.reduce((s, b) => s + (b.stake || 0), 0);
        const totalProfit = settled.reduce((s, b) => s + (b.profit || 0), 0);
        const sportMap = {};
        settled.forEach(b => {
            const s = b.sport || 'Other';
            if (!sportMap[s])
                sportMap[s] = { bets: 0, wins: 0, profit: 0 };
            sportMap[s].bets++;
            if (b.result === 'win')
                sportMap[s].wins++;
            sportMap[s].profit += b.profit || 0;
        });
        const sport_breakdown = Object.entries(sportMap)
            .map(([sport, d]) => ({ sport, ...d, winRate: d.bets ? +(d.wins / d.bets * 100).toFixed(1) : 0 }))
            .sort((a, b) => b.profit - a.profit);
        res.json({
            success: true,
            source: 'db',
            total_bets: bets.length,
            settled_bets: settled.length,
            wins: wins.length,
            total_stake: +totalStake.toFixed(2),
            total_profit: +totalProfit.toFixed(2),
            roi: totalStake ? +(totalProfit / totalStake * 100).toFixed(1) : 0,
            win_rate: settled.length ? +(wins.length / settled.length * 100).toFixed(1) : 0,
            sport_breakdown,
        });
    }
    catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
});
router.get('/dashboard', protect, async (req, res) => {
    if (req.user.role !== 'admin') {
        return res.status(403).json({ success: false, message: 'Admin only' });
    }
    const [snapCol, predCol, lineCol, arbCol, trainCol] = await Promise.all([
        mlCollection('odds_snapshots'), mlCollection('ml_predictions'),
        mlCollection('line_movements'), mlCollection('arb_history'), mlCollection('ml_training_log'),
    ]);
    const now = new Date();
    const oneDayAgo = new Date(now - 24 * 60 * 60 * 1000);
    const [snapshots, predictions, movements, arbs, trainingLog] = await Promise.all([
        snapCol ? snapCol.countDocuments() : 0,
        predCol ? predCol.countDocuments() : 0,
        lineCol ? lineCol.countDocuments() : 0,
        arbCol ? arbCol.countDocuments() : 0,
        trainCol ? trainCol.find({}).sort({ trained_at: -1 }).limit(5).toArray() : [],
    ]);
    const snapshotsToday = snapCol ? await snapCol.countDocuments({ fetched_at: { $gte: oneDayAgo } }) : 0;
    res.json({
        success: true,
        pipeline: {
            total_snapshots: snapshots,
            snapshots_today: snapshotsToday,
            total_predictions: predictions,
            line_movements: movements,
            arb_history: arbs,
            ml_ready: snapshots >= 500,
            data_status: snapshots < 100 ? '🟡 Collecting data'
                : snapshots < 500 ? '🟠 Building dataset'
                    : '🟢 ML Active',
        },
        recent_training: trainingLog.map(t => ({
            trained_at: t.trained_at,
            results: t.results,
        })),
    });
});
module.exports = router;
