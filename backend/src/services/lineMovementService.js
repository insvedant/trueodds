const { mlCollection } = require('./mlDb');
const MARKET_MAP = { spread: 'spreads', spreads: 'spreads', total: 'totals', totals: 'totals', h2h: 'h2h', moneyline: 'h2h' };
function normalizeMarket(market) {
    return MARKET_MAP[(market || '').toLowerCase()] || 'h2h';
}
// book_odds values are either a bare number (h2h — no point exists for a
// moneyline) or {price, point} for spreads/totals. Normalizes both shapes.
function extractPricePoint(oddsValue) {
    if (oddsValue && typeof oddsValue === 'object') {
        if (oddsValue.price === undefined) return null;
        return { price: oddsValue.price, point: oddsValue.point ?? null };
    }
    if (oddsValue !== undefined && oddsValue !== null) {
        return { price: oddsValue, point: null };
    }
    return null;
}
async function getLineMovementSeries(eventId, market, selection = null) {
    const col = mlCollection('odds_snapshots');
    if (!col)
        return { available: false, series: [] };
    const marketKey = normalizeMarket(market);
    const snapshots = await col
        .find({ event_id: eventId }, { projection: { book_odds: 1, fetched_at: 1, is_duplicate: 1 } })
        .sort({ fetched_at: 1 })
        .toArray();
    if (!snapshots.length)
        return { available: true, series: [], gameInfo: null };
    const byBookSelection = {};
    // Snapshots with identical odds to the previous poll are stored as a tiny
    // marker (is_duplicate: true) with no book_odds at all, to save space.
    // Carry the last known market data forward across those markers so the
    // chart still gets a data point at every timestamp, not just changes.
    let lastKnownMarketData = null;
    for (const snap of snapshots) {
        let marketData = null;
        if (!snap.is_duplicate && snap.book_odds && snap.book_odds[marketKey]) {
            marketData = snap.book_odds[marketKey];
            lastKnownMarketData = marketData;
        }
        else if (snap.is_duplicate) {
            marketData = lastKnownMarketData;
        }
        if (!marketData)
            continue;
        for (const [sel, bookPrices] of Object.entries(marketData)) {
            if (selection && sel !== selection)
                continue;
            for (const [book, oddsValue] of Object.entries(bookPrices)) {
                const parsed = extractPricePoint(oddsValue);
                if (!parsed)
                    continue;
                if (!byBookSelection[book])
                    byBookSelection[book] = {};
                if (!byBookSelection[book][sel])
                    byBookSelection[book][sel] = [];
                byBookSelection[book][sel].push({
                    time: snap.fetched_at,
                    point: parsed.point,
                    price: parsed.price,
                });
            }
        }
    }
    return { available: true, byBookSelection, snapshotCount: snapshots.length };
}
// Latest snapshot that actually carries real book_odds (skips duplicate
// markers automatically) — a direct proxy for the closing line.
async function getClosingSnapshot(eventId) {
    const col = mlCollection('odds_snapshots');
    if (!col)
        return null;
    return col.find({ event_id: eventId, book_odds: { $exists: true } }).sort({ fetched_at: -1 }).limit(1).next();
}
function findOutcomeInSnapshot(snapshot, market, selection, preferBook = null) {
    if (!snapshot || !snapshot.book_odds)
        return null;
    const marketKey = normalizeMarket(market);
    const marketData = snapshot.book_odds[marketKey];
    if (!marketData || !marketData[selection])
        return null;
    const bookPrices = marketData[selection];
    const bookKeys = Object.keys(bookPrices);
    const ordered = preferBook && bookPrices[preferBook] !== undefined
        ? [preferBook, ...bookKeys.filter(b => b !== preferBook)]
        : bookKeys;
    for (const book of ordered) {
        const parsed = extractPricePoint(bookPrices[book]);
        if (parsed)
            return { book, price: parsed.price, point: parsed.point };
    }
    return null;
}
function americanToDecimal(american) {
    if (american >= 100)
        return (american / 100) + 1;
    if (american <= -100)
        return (100 / Math.abs(american)) + 1;
    return 1;
}
async function getSteamMoves(windowMinutes = 15, sport = null) {
    const col = mlCollection('line_movements');
    if (!col)
        return { available: false, data: [] };
    const since = new Date(Date.now() - windowMinutes * 60 * 1000);
    const match = { timestamp: { $gte: since }, is_sharp_book: true };
    if (sport)
        match.sport = sport;
    const pipeline = [
        { $match: match },
        { $group: {
                _id: { event_id: '$event_id', market: '$market', selection: '$selection', moved_up: '$moved_up' },
                books: { $addToSet: '$book' },
                sport: { $first: '$sport' },
                latestTimestamp: { $max: '$timestamp' },
                avgProbChange: { $avg: '$prob_change' },
            } },
        { $match: { $expr: { $gte: [{ $size: '$books' }, 2] } } },
        { $sort: { latestTimestamp: -1 } },
        { $limit: 50 },
    ];
    const results = await col.aggregate(pipeline).toArray();
    return {
        available: true,
        data: results.map(r => ({
            id: `${r._id.event_id}_${r._id.market}_${r._id.selection}_${r._id.moved_up}`,
            eventId: r._id.event_id,
            sport: r.sport,
            market: r._id.market,
            selection: r._id.selection,
            direction: r._id.moved_up ? 'up' : 'down',
            sharpBooks: r.books,
            bookCount: r.books.length,
            avgProbChangePct: Math.round(r.avgProbChange * 10000) / 100,
            detectedAt: r.latestTimestamp,
        })),
    };
}
module.exports = { getLineMovementSeries, getClosingSnapshot, findOutcomeInSnapshot, americanToDecimal, normalizeMarket, getSteamMoves };
