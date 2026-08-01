const router = require('express').Router();
const { protect, optionalAuth, requirePlan } = require('../middleware/auth');
const { getOdds, getAllOdds, getArbitrage, getPositiveEV, getScores, getSportKey, getQuotaInfo, bustMemCache, } = require('../services/apiService');
router.get('/odds', optionalAuth, async (req, res) => {
    try {
        const { sport = 'All', market = 'h2h' } = req.query;
        const { data: allData, source } = (sport === 'All' || sport === 'Soccer')
            ? await getAllOdds()
            : await getOdds(getSportKey(sport), market);
        const data = (sport === 'Soccer')
            ? allData.filter(g => g.sport === 'Soccer')
            : allData;
        const limited = (!req.user || req.user.plan === 'free');
        const gated = limited
            ? data.map(game => ({
                ...game,
                markets: game.markets.map(mkt => ({
                    ...mkt,
                    rows: mkt.rows.map(row => ({
                        ...row,
                        books: Object.fromEntries(Object.entries(row.books).slice(0, 2)),
                    })),
                })),
            }))
            : data;
        res.json({
            success: true,
            sport, market, source,
            count: gated.length,
            data: gated,
            quota: getQuotaInfo(),
        });
    }
    catch (err) {
        console.error('Odds route error:', err.message);
        res.status(500).json({ success: false, message: err.message });
    }
});
router.get('/arbitrage', protect, async (req, res) => {
    try {
        const { minProfit = 0 } = req.query;
        const { data, source } = await getArbitrage(parseFloat(minProfit), null);
        const plan = req.user?.plan || 'free';
        const isFree = plan === 'free';
        const limited = isFree ? data.slice(0, 3) : data;
        res.json({
            success: true,
            source,
            count: limited.length,
            total: data.length,
            limited: isFree,
            hot: limited.filter(a => a.hot).length,
            data: limited,
            quota: getQuotaInfo(),
        });
    }
    catch (err) {
        console.error('Arb route error:', err.message);
        res.status(500).json({ success: false, message: err.message });
    }
});
router.get('/ev', protect, requirePlan('gold', 'platinum'), async (req, res) => {
    const t0 = Date.now();
    console.log(`[EV] request start — user=${req.user?.id} plan=${req.user?.plan}`);
    try {
        const { minEV = 0 } = req.query;
        const { data, source } = await getPositiveEV(parseFloat(minEV), null);
        console.log(`[EV] request done in ${Date.now() - t0}ms — source=${source} count=${data.length}`);
        res.json({
            success: true,
            source,
            count: data.length,
            data,
            quota: getQuotaInfo(),
        });
    }
    catch (err) {
        console.error(`[EV] request FAILED after ${Date.now() - t0}ms:`, err.message, err.stack);
        res.status(500).json({ success: false, message: err.message });
    }
});
router.get('/scores', optionalAuth, async (req, res) => {
    try {
        const { sport = 'NBA', date } = req.query;
        const { data, source } = await getScores(sport, date || null);
        res.json({
            success: true,
            sport, source,
            count: data.length,
            data,
        });
    }
    catch (err) {
        console.error('Scores route error:', err.message);
        res.status(500).json({ success: false, message: err.message });
    }
});
router.get('/quota', protect, (req, res) => {
    res.json({ success: true, quota: getQuotaInfo() });
});
router.get('/dashboard/prefetch', protect, async (req, res) => {
    const t0 = Date.now();
    console.log(`[PREFETCH] request start — user=${req.user?.id} plan=${req.user?.plan}`);
    try {
        const [arbResult, evResult] = await Promise.allSettled([
            getArbitrage(0, null),
            getPositiveEV(0, null),
        ]);
        if (arbResult.status === 'rejected')
            console.error(`[PREFETCH] getArbitrage rejected:`, arbResult.reason?.message, arbResult.reason?.stack);
        if (evResult.status === 'rejected')
            console.error(`[PREFETCH] getPositiveEV rejected:`, evResult.reason?.message, evResult.reason?.stack);
        const plan = req.user?.plan || 'free';
        const isFree = plan === 'free';
        const arbData = arbResult.status === 'fulfilled' ? arbResult.value.data : [];
        const evData = evResult.status === 'fulfilled' ? evResult.value.data : [];
        console.log(`[PREFETCH] request done in ${Date.now() - t0}ms — arb=${arbData.length} ev=${evData.length}`);
        res.json({
            success: true,
            arb: {
                data: isFree ? arbData.slice(0, 3) : arbData,
                limited: isFree,
                total: arbData.length,
                hot: arbData.filter(a => a.hot).length,
                source: arbResult.status === 'fulfilled' ? arbResult.value.source : 'error',
            },
            ev: {
                data: evData,
                count: evData.length,
                source: evResult.status === 'fulfilled' ? evResult.value.source : 'error',
            },
            quota: getQuotaInfo(),
        });
    }
    catch (err) {
        console.error(`[PREFETCH] request FAILED after ${Date.now() - t0}ms:`, err.message, err.stack);
        res.status(500).json({ success: false, message: err.message });

    }
});
router.post('/refresh', protect, async (req, res) => {
    try {
        const Cache = require('../models/Cache');
        await Cache.deleteMany({ key: { $regex: /^(odds:|arb:|ev:)/ } });
        bustMemCache();
        res.json({ success: true, message: 'Cache cleared. Next fetch will pull fresh data from TheOddsAPI.' });
    }
    catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
});
module.exports = router;
