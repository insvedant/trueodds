/**
 * backend/src/services/lineMovementService.js
 *
 * Reads from the ML database's odds_snapshots / line_movements collections
 * (via mlDb.js) and turns the raw TheOddsAPI payloads stored there into
 * time-series data for the Total Line Movement, Spread Steam Detection,
 * and Closing Line Value tools.
 */

const { mlCollection } = require('./mlDb')

const MARKET_MAP = { spread: 'spreads', spreads: 'spreads', total: 'totals', totals: 'totals', h2h: 'h2h', moneyline: 'h2h' }

function normalizeMarket(market) {
  return MARKET_MAP[(market || '').toLowerCase()] || 'h2h'
}

// Pulls, for one event + market + selection, the (time, point, price) series
// across every snapshot on record, per book.
async function getLineMovementSeries(eventId, market, selection = null) {
  const col = mlCollection('odds_snapshots')
  if (!col) return { available: false, series: [] }

  const marketKey = normalizeMarket(market)
  const snapshots = await col
    .find({ event_id: eventId }, { projection: { raw_bookmakers: 1, fetched_at: 1, commence_time: 1 } })
    .sort({ fetched_at: 1 })
    .toArray()

  if (!snapshots.length) return { available: true, series: [], gameInfo: null }

  const byBookSelection = {}

  for (const snap of snapshots) {
    for (const bm of snap.raw_bookmakers || []) {
      const mkt = (bm.markets || []).find(m => m.key === marketKey)
      if (!mkt) continue
      for (const outcome of mkt.outcomes || []) {
        if (selection && outcome.name !== selection) continue
        if (!byBookSelection[bm.key]) byBookSelection[bm.key] = {}
        if (!byBookSelection[bm.key][outcome.name]) byBookSelection[bm.key][outcome.name] = []
        byBookSelection[bm.key][outcome.name].push({
          time:  snap.fetched_at,
          point: outcome.point ?? null,
          price: outcome.price,
        })
      }
    }
  }

  return { available: true, byBookSelection, snapshotCount: snapshots.length }
}

// The last known snapshot for an event — used as a proxy "closing line" since
// the collector generally stops shortly after commence_time.
async function getClosingSnapshot(eventId) {
  const col = mlCollection('odds_snapshots')
  if (!col) return null
  return col.find({ event_id: eventId }).sort({ fetched_at: -1 }).limit(1).next()
}

function findOutcomeInSnapshot(snapshot, market, selection, preferBook = null) {
  if (!snapshot) return null
  const marketKey = normalizeMarket(market)
  const books = snapshot.raw_bookmakers || []
  const ordered = preferBook ? [...books].sort((a, b) => (a.key === preferBook ? -1 : b.key === preferBook ? 1 : 0)) : books
  for (const bm of ordered) {
    const mkt = (bm.markets || []).find(m => m.key === marketKey)
    if (!mkt) continue
    const outcome = (mkt.outcomes || []).find(o => o.name === selection)
    if (outcome) return { book: bm.key, price: outcome.price, point: outcome.point ?? null }
  }
  return null
}

function americanToDecimal(american) {
  if (american >= 100) return (american / 100) + 1
  if (american <= -100) return (100 / Math.abs(american)) + 1
  return 1
}

// Flags cases where 2+ sharp books (Pinnacle, Circa, Bookmaker — see
// ml/config.py's SHARP_BOOKS) moved a line the same direction within a
// recent window. Reads the already-computed line_movements collection
// directly — no point-history dependency, works off existing data.
async function getSteamMoves(windowMinutes = 15, sport = null) {
  const col = mlCollection('line_movements')
  if (!col) return { available: false, data: [] }

  const since = new Date(Date.now() - windowMinutes * 60 * 1000)
  const match = { timestamp: { $gte: since }, is_sharp_book: true }
  if (sport) match.sport = sport

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
  ]

  const results = await col.aggregate(pipeline).toArray()
  return {
    available: true,
    data: results.map(r => ({
      id:            `${r._id.event_id}_${r._id.market}_${r._id.selection}_${r._id.moved_up}`,
      eventId:       r._id.event_id,
      sport:         r.sport,
      market:        r._id.market,
      selection:     r._id.selection,
      direction:     r._id.moved_up ? 'up' : 'down',
      sharpBooks:    r.books,
      bookCount:     r.books.length,
      avgProbChangePct: Math.round(r.avgProbChange * 10000) / 100,
      detectedAt:    r.latestTimestamp,
    })),
  }
}

module.exports = { getLineMovementSeries, getClosingSnapshot, findOutcomeInSnapshot, americanToDecimal, normalizeMarket, getSteamMoves }
