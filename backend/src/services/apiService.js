

const Cache = require('../models/Cache')

const ODDS_API_KEY  = process.env.THEODDSAPI_KEY
const ODDS_BASE     = 'https://api.the-odds-api.com/v4'
const SPORTSDB_BASE = 'https://www.thesportsdb.com/api/v1/json/3'

const TTL = {
  ODDS:      5  * 60,          // 5 minutes (was 1 min — was burning quota fast)
  SCORES:    10 * 60,          // 10 minutes
  TEAM_META: 24 * 60 * 60,    // 24 hours
}

const ALL_BOOKS = [
  'draftkings', 'fanduel', 'betmgm', 'caesars', 'pointsbet',
  'bet365', 'pinnacle', 'bovada', 'williamhill_us', 'barstool',
  'mybookieag', 'betonlineag', 'lowvig', 'superbook',
]

const SPORTS = [
  'basketball_nba',
  'basketball_nba_championship_winner',
  'baseball_mlb',
  'icehockey_nhl',
  'icehockey_nhl_championship_winner',
  'americanfootball_nfl',
  'americanfootball_nfl_preseason',
  'americanfootball_cfl',
  'soccer_epl',
  'soccer_uefa_champs_league',
  'soccer_uefa_europa_league',
  'soccer_france_ligue_one',
  'soccer_germany_bundesliga',
  'soccer_spain_la_liga',
  'soccer_italy_serie_a',
  'soccer_usa_mls',
  'soccer_canada_cpl',
  'soccer_brazil_campeonato',
  'soccer_argentina_primera_division',
  'soccer_fifa_world_cup',
  'mma_mixed_martial_arts',
  'boxing_boxing',
  'tennis_atp_french_open',
  'tennis_wta_french_open',
  'tennis_atp_wimbledon',
  'tennis_wta_wimbledon',
  'tennis_atp_us_open',
  'tennis_wta_us_open',
]

let quotaState = {
  remaining: null,
  used:      null,
  lastCheck: null,
}

function isKeyConfigured() {
  return ODDS_API_KEY &&
         !ODDS_API_KEY.includes('REPLACE') &&
         ODDS_API_KEY.length > 10
}

async function fetchJSON(url, headers = {}) {
  const res = await fetch(url, {
    headers,
    signal: AbortSignal.timeout(10_000),
  })

  
  const remaining = res.headers.get('x-requests-remaining')
  const used      = res.headers.get('x-requests-used')
  if (remaining !== null) {
    const prev = quotaState.remaining
    quotaState.remaining = parseInt(remaining)
    quotaState.used      = parseInt(used || '0')
    quotaState.lastCheck = new Date()
    // Only log when quota is low or drops by 1000+ (not every single call)
    const dropped = prev - quotaState.remaining
    if (quotaState.remaining < 500000 || dropped >= 1000) {
      console.log(`[TheOddsAPI] Remaining: ${remaining} | Used: ${used}`)
    }
  }

  if (!res.ok) {
    const body = await res.text().catch(() => '')
    throw new Error(`TheOddsAPI ${res.status}: ${body.slice(0, 200)}`)
  }

  return res.json()
}

async function getSports() {
  const key     = 'sports:list'
  const cached  = await Cache.get(key)
  if (cached) return { data: cached, source: 'cache' }

  if (!isKeyConfigured()) return { data: getMockSports(), source: 'mock' }

  const data = await fetchJSON(
    `${ODDS_BASE}/sports?apiKey=${ODDS_API_KEY}&all=true`
  )
  await Cache.set(key, data, TTL.TEAM_META, 'api')
  return { data, source: 'api' }
}

async function getOdds(sport = 'americanfootball_nfl', market = 'h2h') {
  const key    = `odds:${sport}:${market}`
  const cached = await Cache.get(key)
  if (cached) return { data: cached, source: 'cache' }

  if (!isKeyConfigured()) return { data: [], source: 'mock' }

  const url = [
    `${ODDS_BASE}/sports/${sport}/odds`,
    `?apiKey=${ODDS_API_KEY}`,
    `&regions=us,us2,uk,eu,au,ca`,
    `&markets=${market}`,
    `&oddsFormat=american`,
  ].join('')

  const raw  = await fetchJSON(url)
  const data = transformOdds(raw, sport, market)
  // Only cache if we got actual data — don't cache empty results
  if (data && data.length > 0) {
    await Cache.set(key, data, TTL.ODDS, 'api')
  }
  return { data: data || [], source: 'api' }
}

async function getAllOdds() {
  const key    = 'odds:all'
  const cached = await Cache.get(key)
  if (cached) return { data: cached, source: 'cache' }

  if (!isKeyConfigured()) return { data: [], source: 'mock' }

  // Football/hockey get spreads too — more books post spread lines = more arb
  const SPREAD_SPORTS = ['americanfootball_cfl','americanfootball_nfl','icehockey_nhl']

  const fetches = []
  for (const sport of SPORTS) {
    const markets = SPREAD_SPORTS.includes(sport) ? ['h2h','spreads'] : ['h2h']
    for (const market of markets) {
      fetches.push(getOdds(sport, market))
    }
  }

  const results = await Promise.allSettled(fetches)

  // Merge by game id so spread + h2h markets combine into one game object
  const gameMap = {}
  for (const res of results) {
    if (res.status !== 'fulfilled' || !res.value.data || !res.value.data.length) continue
    for (const game of res.value.data) {
      if (gameMap[game.id]) {
        gameMap[game.id].markets.push(...game.markets)
      } else {
        gameMap[game.id] = Object.assign({}, game, { markets: [...game.markets] })
      }
    }
  }

  const combined = Object.values(gameMap)

  if (combined.length > 0) {
    await Cache.set(key, combined, TTL.ODDS, 'api')
    return { data: combined, source: 'api' }
  }
  return { data: [], source: 'empty' }
}

async function getArbitrage(minProfit = 0, sport = null) {
  const key    = `arb:${sport || 'all'}:${minProfit}`
  const cached = await Cache.get(key)
  if (cached) return { data: cached, source: 'cache' }

  let odds = []
  let source = 'api'

  if (sport) {
    const sportKey = getSportKey(sport)
    // For hockey and football fetch both h2h and spreads for more arb opportunities
    const markets = ['NHL','CFL','NFL'].includes(sport) ? ['h2h','spreads'] : ['h2h']
    const results = await Promise.allSettled(markets.map(m => getOdds(sportKey, m)))
    for (const r of results) {
      if (r.status === 'fulfilled' && r.value.data?.length) {
        // Merge markets from same games
        for (const game of r.value.data) {
          const existing = odds.find(g => g.id === game.id)
          if (existing) {
            existing.markets.push(...game.markets)
          } else {
            odds.push(game)
          }
        }
        source = r.value.source
      }
    }
  } else {
    const result = await getAllOdds()
    odds = result.data
    source = result.source
  }

  const arbs = calcArbitrage(odds, minProfit)
  if (arbs.length > 0) {
    await Cache.set(key, arbs, TTL.ODDS, source)
  }
  return { data: arbs, source }
}

async function getPositiveEV(minEV = 0, sport = null) {
  const key    = `ev:${sport || 'all'}:${minEV}`
  const cached = await Cache.get(key)
  if (cached) return { data: cached, source: 'cache' }

  const { data: odds, source } = sport
    ? await getOdds(getSportKey(sport), 'h2h')
    : await getAllOdds()

  const evBets = calcEV(odds, minEV)
  if (evBets.length > 0) {
    await Cache.set(key, evBets, TTL.ODDS, source)
  }
  return { data: evBets, source }
}

async function getScores(sport = 'NBA') {
  const key    = `scores:${sport}`
  const cached = await Cache.get(key)
  if (cached) return { data: cached, source: 'cache' }

  if (!isKeyConfigured()) return { data: [], source: 'mock' }

  const sportKey = getSportKey(sport)
  const url      = `${ODDS_BASE}/sports/${sportKey}/scores?apiKey=${ODDS_API_KEY}&daysFrom=1`

  const raw  = await fetchJSON(url).catch(() => [])
  const data = (Array.isArray(raw) ? raw : []).slice(0, 20).map(g => ({
    id:        g.id,
    sport,
    home:      g.home_team,
    away:      g.away_team,
    homeScore: g.scores?.find(s => s.name === g.home_team)?.score ?? null,
    awayScore: g.scores?.find(s => s.name === g.away_team)?.score ?? null,
    completed: g.completed,
    time:      g.commence_time,
  }))

  await Cache.set(key, data, TTL.SCORES, 'api')
  return { data, source: 'api' }
}

async function getTeamLogo(teamName) {
  const key    = `team:${teamName.toLowerCase().replace(/\s/g, '_')}`
  const cached = await Cache.get(key)
  if (cached) return cached

  try {
    const data = await fetchJSON(
      `${SPORTSDB_BASE}/searchteams.php?t=${encodeURIComponent(teamName)}`
    )
    const team   = data?.teams?.[0]
    const result = {
      name:   team?.strTeam  || teamName,
      logo:   team?.strTeamBadge || null,
      league: team?.strLeague || null,
    }
    await Cache.set(key, result, TTL.TEAM_META, 'api')
    return result
  } catch {
    return { name: teamName, logo: null }
  }
}

function getQuotaInfo() {
  return {
    remaining:           quotaState.remaining,
    used:                quotaState.used,
    lastCheck:           quotaState.lastCheck,
    oddsApiConfigured:   isKeyConfigured(),
    plan:                isKeyConfigured() ? 'paid' : 'unconfigured',
    cacheTTL_seconds:    TTL.ODDS,
  }
}

const SPORT_LABELS = {
  americanfootball_nfl:                   'NFL',
  americanfootball_nfl_super_bowl_winner: 'NFL',
  basketball_nba:                         'NBA',
  basketball_nba_championship_winner:     'NBA',
  baseball_mlb:                           'MLB',
  icehockey_nhl:                          'NHL',
  icehockey_nhl_championship_winner:      'NHL',
  soccer_epl:                             'Soccer',
  soccer_uefa_champs_league:              'Soccer',
  soccer_uefa_europa_league:              'Soccer',
  soccer_france_ligue_one:                'Soccer',
  soccer_germany_bundesliga:              'Soccer',
  soccer_spain_la_liga:                   'Soccer',
  soccer_italy_serie_a:                   'Soccer',
  americanfootball_cfl:                   'CFL',
  soccer_usa_mls:                         'Soccer',
  soccer_canada_cpl:                      'Soccer',
  soccer_fifa_world_cup:                  'Soccer',
  americanfootball_cfl:                   'CFL',
  icehockey_ahl:                          'AHL',
  mma_mixed_martial_arts:                 'UFC',
  boxing_boxing:                          'Boxing',
  tennis_atp_french_open:                 'Tennis',
  tennis_wta_french_open:                 'Tennis',
  tennis_atp_us_open:                     'Tennis',
  tennis_wta_us_open:                     'Tennis',
  tennis_atp_wimbledon:                   'Tennis',
  tennis_wta_wimbledon:                   'Tennis',
}

function transformOdds(games, sportKey, market) {
  const sport = SPORT_LABELS[sportKey] || sportKey

  const now = Date.now()

  return games
    .filter(game => {
      if (!game.commence_time) return true
      const gameTime = new Date(game.commence_time).getTime()
      // For EV/arb calculations only show games starting within next 7 days
      // or already started within last 3 hours (live)
      return gameTime >= now - 3 * 60 * 60 * 1000
    })
    .map(game => {
    const allBooks = {}

    for (const bm of game.bookmakers || []) {
      const mkt = (bm.markets || []).find(m => m.key === market)
      if (!mkt) continue
      for (const outcome of mkt.outcomes) {
        if (!allBooks[outcome.name]) allBooks[outcome.name] = {}
        allBooks[outcome.name][bm.key] = outcome.price
      }
    }

    const rows = Object.entries(allBooks).map(([selection, books]) => {
      const prices   = Object.values(books)
      const bestOdds = Math.max(...prices)
      const bestBook = Object.keys(books).find(k => books[k] === bestOdds) || ''
      const avg      = Math.round(prices.reduce((a, b) => a + b, 0) / prices.length)

      return {
        selection,
        bestOdds:  bestOdds > 0 ? `+${bestOdds}` : `${bestOdds}`,
        bestBook,
        avgOdds:   avg > 0 ? `+${avg}` : `${avg}`,
        books: Object.fromEntries(
          Object.entries(books).map(([k, v]) => [k, v > 0 ? `+${v}` : `${v}`])
        ),
      }
    })

    return {
      id:     game.id,
      game:   `${game.home_team} vs ${game.away_team}`,
      sport,
      market: market === 'h2h' ? 'Moneyline' : market === 'spreads' ? 'Spread' : 'Total O/U',
      time:   new Date(game.commence_time).toLocaleString('en-US', {
        weekday: 'short', month: 'short', day: 'numeric',
        hour: 'numeric', minute: '2-digit',
      }),
      league:  game.sport_title,
      markets: [{ name: market === 'h2h' ? 'Moneyline' : market, rows }],
      isLive: game.commence_time ? new Date(game.commence_time).getTime() <= now : false,
    }
  }).filter(g => g.markets[0].rows.length > 0)
}

function dec(american) {
  if (american >= 100)  return (american / 100) + 1
  if (american <= -100) return (100 / Math.abs(american)) + 1
  return 1
}

function calcArbitrage(games, minProfit = 0) {
  const arbs = []

  for (const game of games) {
    for (const mkt of game.markets || []) {
      
      const best = {}
      for (const row of mkt.rows || []) {
        const bestNum = parseInt(row.bestOdds) || 0
        best[row.selection] = {
          odds: bestNum, dec: dec(bestNum),
          book: row.bestBook, display: row.bestOdds,
        }
      }

      const outcomes  = Object.entries(best)
      if (outcomes.length < 2) continue

      const impliedSum = outcomes.reduce((s, [, o]) => s + (1 / o.dec), 0)
      if (impliedSum >= 1.0) continue

      const profitPct = ((1 - impliedSum) / impliedSum) * 100
      if (profitPct < minProfit) continue

      const stake = 1000
      const legs  = outcomes.map(([sel, o]) => ({
        selection: sel,
        book:      o.book,
        odds:      o.display,
        stake:     Math.round((stake / o.dec) / impliedSum * 100) / 100,
        dec:       o.dec,
      }))

      arbs.push({
        id:       `${game.id}_${mkt.name}`,
        game:     game.game,
        sport:    game.sport,
        market:   mkt.name,
        profit:   Math.round(profitPct * 100) / 100,
        legs,
        b1:       legs[0]?.book || '',
        b2:       legs[1]?.book || '',
        o1:       legs[0]?.odds || '',
        o2:       legs[1]?.odds || '',
        stake1:   legs[0]?.stake || 0,
        stake2:   legs[1]?.stake || 0,
        time:     game.time,
        ageMin:   0,
        hot:      profitPct >= 2.0,
      })
    }
  }

  return arbs.sort((a, b) => b.profit - a.profit)
}

const SHARP_BOOKS = ['pinnacle', 'bet365', 'draftkings', 'fanduel', 'betmgm', 'caesars']

function getFairOdds(books) {
  for (const sharp of SHARP_BOOKS) {
    const odds = parseInt(books?.[sharp]) || 0
    if (odds) return { fairOdds: odds, sharpBook: sharp }
  }
  const allOdds = Object.values(books || {}).map(o => parseInt(o)).filter(o => o)
  if (allOdds.length < 2) return null
  const avgDec = allOdds.reduce((s, o) => s + dec(o), 0) / allOdds.length
  const impliedAmerican = avgDec >= 2
    ? Math.round((avgDec - 1) * 100)
    : Math.round(-100 / (avgDec - 1))
  return { fairOdds: impliedAmerican, sharpBook: 'market_avg' }
}

function calcEV(games, minEV = 0) {
  const evBets = []

  for (const game of games) {
    for (const mkt of game.markets || []) {
      for (const row of mkt.rows || []) {
        const fair = getFairOdds(row.books)
        if (!fair) continue

        const { fairOdds, sharpBook } = fair
        const fairDec  = dec(fairOdds)
        const trueProb = 1 / fairDec

        for (const [bookKey, oddsStr] of Object.entries(row.books || {})) {
          if (bookKey === sharpBook) continue
          const bookOdds = parseInt(oddsStr) || 0
          if (!bookOdds) continue

          const bookDec = dec(bookOdds)
          const ev      = (trueProb * bookDec - 1) * 100
          if (ev < minEV) continue
          if (ev > 30) continue  // Skip unrealistic values — indicates stale/mismatched odds

          const b     = bookDec - 1
          const q     = 1 - trueProb
          const kelly = Math.max(0, (b * trueProb - q) / b) * 100

          evBets.push({
            id:        `${game.id}_${bookKey}_${row.selection}`,
            game:      game.game,
            sport:     game.sport,
            league:    game.league || '',
            market:    `${mkt.name} — ${row.selection}`,
            ev:        Math.round(ev * 100) / 100,
            bookOdds:  bookOdds > 0 ? `+${bookOdds}` : `${bookOdds}`,
            fairOdds:  fairOdds > 0 ? `+${fairOdds}` : `${fairOdds}`,
            book:      bookKey,
            prob:      `${(trueProb * 100).toFixed(1)}%`,
            kelly:     Math.round(kelly * 10) / 10,
            size:      Math.round(kelly * 0.25 * 100) / 100,
            time:      game.time,
          })
        }
      }
    }
  }

  return evBets.sort((a, b) => b.ev - a.ev)
}

function getSportKey(label) {
  const map = {
    NFL:    'americanfootball_nfl',
    CFL:    'americanfootball_cfl',
    CFL:    'americanfootball_cfl',
    NBA:    'basketball_nba',
    MLB:    'baseball_mlb',
    NHL:    'icehockey_nhl',
    AHL:    'icehockey_ahl',
    Soccer: 'soccer_usa_mls',
    UFC:    'mma_mixed_martial_arts',
    Tennis: 'tennis_atp_french_open',
  }
  return map[label] || 'baseball_mlb'
}

function getMockSports() {
  return [
    { key: 'americanfootball_nfl',    title: 'NFL',          active: true },
    { key: 'americanfootball_cfl',    title: 'CFL',          active: true },
    { key: 'americanfootball_cfl',    title: 'CFL',          active: true },
    { key: 'basketball_nba',          title: 'NBA',          active: true },
    { key: 'baseball_mlb',            title: 'MLB',          active: true },
    { key: 'icehockey_nhl',           title: 'NHL',          active: true },
    { key: 'icehockey_ahl',           title: 'AHL',          active: true },
    { key: 'soccer_usa_mls',          title: 'MLS Soccer',   active: true },
    { key: 'soccer_canada_cpl',       title: 'CPL Soccer',   active: true },
    { key: 'mma_mixed_martial_arts',  title: 'UFC/MMA',      active: true },
  ]
}

module.exports = {
  getSports,
  getOdds,
  getAllOdds,
  getArbitrage,
  getPositiveEV,
  getScores,
  getTeamLogo,
  getQuotaInfo,
  getSportKey,
  isKeyConfigured,
}
