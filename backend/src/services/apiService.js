const Cache = require('../models/Cache');
const ODDS_API_KEY = process.env.THEODDSAPI_KEY;
const ODDS_BASE = 'https://api.the-odds-api.com/v4';
const SPORTSDB_BASE = 'https://www.thesportsdb.com/api/v1/json/3';
const TTL = {
    ODDS: 5 * 60,
    SCORES: 10 * 60,
    TEAM_META: 24 * 60 * 60,
};
const ALL_BOOKS = [
    'draftkings', 'fanduel', 'betmgm', 'caesars', 'pointsbet',
    'bet365', 'pinnacle', 'bovada', 'williamhill_us', 'barstool',
    'mybookieag', 'betonlineag', 'lowvig', 'superbook',
];
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
];
let quotaState = {
    remaining: null,
    used: null,
    lastCheck: null,
};
const _memCache = new Map();
function memGet(key) {
    const entry = _memCache.get(key);
    if (!entry)
        return null;
    if (entry.expiresAt <= Date.now()) {
        _memCache.delete(key);
        return null;
    }
    return entry.data;
}
function memSet(key, data, ttlSeconds) {
    _memCache.set(key, { data, expiresAt: Date.now() + ttlSeconds * 1000 });
}
function memDel(key) {
    if (key.endsWith('*')) {
        const prefix = key.slice(0, -1);
        for (const k of _memCache.keys()) {
            if (k.startsWith(prefix))
                _memCache.delete(k);
        }
    }
    else {
        _memCache.delete(key);
    }
}
function isKeyConfigured() {
    return ODDS_API_KEY &&
        !ODDS_API_KEY.includes('REPLACE') &&
        ODDS_API_KEY.length > 10;
}
async function fetchJSON(url, headers = {}) {
    const res = await fetch(url, {
        headers,
        signal: AbortSignal.timeout(10000),
    });
    const remaining = res.headers.get('x-requests-remaining');
    const used = res.headers.get('x-requests-used');
    if (remaining !== null) {
        const prev = quotaState.remaining;
        quotaState.remaining = parseInt(remaining);
        quotaState.used = parseInt(used || '0');
        quotaState.lastCheck = new Date();
        const dropped = prev - quotaState.remaining;
        if (quotaState.remaining < 500000 || dropped >= 1000) {
            console.log(`[TheOddsAPI] Remaining: ${remaining} | Used: ${used}`);
        }
    }
    if (!res.ok) {
        const body = await res.text().catch(() => '');
        throw new Error(`TheOddsAPI ${res.status}: ${body.slice(0, 200)}`);
    }
    return res.json();
}
async function getSports() {
    const key = 'sports:list';
    const mem = memGet(key);
    if (mem)
        return { data: mem, source: 'mem' };
    const cached = await Cache.get(key);
    if (cached) {
        memSet(key, cached, TTL.TEAM_META);
        return { data: cached, source: 'cache' };
    }
    if (!isKeyConfigured())
        return { data: getMockSports(), source: 'mock' };
    const data = await fetchJSON(`${ODDS_BASE}/sports?apiKey=${ODDS_API_KEY}&all=true`);
    await Cache.set(key, data, TTL.TEAM_META, 'api');
    memSet(key, data, TTL.TEAM_META);
    return { data, source: 'api' };
}
async function getOdds(sport = 'americanfootball_nfl', market = 'h2h') {
    const key = `odds:${sport}:${market}`;
    const mem = memGet(key);
    if (mem)
        return { data: mem, source: 'mem' };
    const cached = await Cache.get(key);
    if (cached) {
        memSet(key, cached, TTL.ODDS);
        return { data: cached, source: 'cache' };
    }
    if (!isKeyConfigured())
        return { data: [], source: 'mock' };
    const url = [
        `${ODDS_BASE}/sports/${sport}/odds`,
        `?apiKey=${ODDS_API_KEY}`,
        `&regions=us,us2,uk,eu,au,ca`,
        `&markets=${market}`,
        `&oddsFormat=american`,
    ].join('');
    const raw = await fetchJSON(url);
    const data = transformOdds(raw, sport, market);
    if (data && data.length > 0) {
        await Cache.set(key, data, TTL.ODDS, 'api');
        memSet(key, data, TTL.ODDS);
    }
    return { data: data || [], source: 'api' };
}
async function getAllOdds() {
    const key = 'odds:all';
    const mem = memGet(key);
    if (mem)
        return { data: mem, source: 'mem' };
    const cached = await Cache.get(key);
    if (cached) {
        memSet(key, cached, TTL.ODDS);
        return { data: cached, source: 'cache' };
    }
    if (!isKeyConfigured())
        return { data: [], source: 'mock' };
    const SPREAD_SPORTS = ['americanfootball_cfl', 'americanfootball_nfl', 'icehockey_nhl'];
    const fetches = [];
    for (const sport of SPORTS) {
        const markets = SPREAD_SPORTS.includes(sport) ? ['h2h', 'spreads'] : ['h2h'];
        for (const market of markets) {
            fetches.push(getOdds(sport, market));
        }
    }
    const results = await Promise.allSettled(fetches);
    const gameMap = {};
    for (const res of results) {
        if (res.status !== 'fulfilled' || !res.value.data || !res.value.data.length)
            continue;
        for (const game of res.value.data) {
            if (gameMap[game.id]) {
                gameMap[game.id].markets.push(...game.markets);
            }
            else {
                gameMap[game.id] = Object.assign({}, game, { markets: [...game.markets] });
            }
        }
    }
    const combined = Object.values(gameMap);
    if (combined.length > 0) {
        await Cache.set(key, combined, TTL.ODDS, 'api');
        memSet(key, combined, TTL.ODDS);
        return { data: combined, source: 'api' };
    }
    return { data: [], source: 'empty' };
}
async function getArbitrage(minProfit = 0, sport = null) {
    const key = `arb:${sport || 'all'}:${minProfit}`;
    const mem = memGet(key);
    if (mem)
        return { data: mem, source: 'mem' };
    const cached = await Cache.get(key);
    if (cached) {
        memSet(key, cached, TTL.ODDS);
        return { data: cached, source: 'cache' };
    }
    let odds = [];
    let source = 'api';
    if (sport) {
        const sportKey = getSportKey(sport);
        const markets = ['NHL', 'CFL', 'NFL'].includes(sport) ? ['h2h', 'spreads'] : ['h2h'];
        const results = await Promise.allSettled(markets.map(m => getOdds(sportKey, m)));
        for (const r of results) {
            if (r.status === 'fulfilled' && r.value.data?.length) {
                for (const game of r.value.data) {
                    const existing = odds.find(g => g.id === game.id);
                    if (existing) {
                        existing.markets.push(...game.markets);
                    }
                    else {
                        odds.push(game);
                    }
                }
                source = r.value.source;
            }
        }
    }
    else {
        const result = await getAllOdds();
        odds = result.data;
        source = result.source;
    }
    const arbs = calcArbitrage(odds, minProfit);
    if (arbs.length > 0) {
        await Cache.set(key, arbs, TTL.ODDS, source);
        memSet(key, arbs, TTL.ODDS);
    }
    return { data: arbs, source };
}
async function getPositiveEV(minEV = 0, sport = null) {
    const key = `ev:${sport || 'all'}:${minEV}`;
    const mem = memGet(key);
    if (mem)
        return { data: mem, source: 'mem' };
    const cached = await Cache.get(key);
    if (cached) {
        memSet(key, cached, TTL.ODDS);
        return { data: cached, source: 'cache' };
    }
    const { data: odds, source } = sport
        ? await getOdds(getSportKey(sport), 'h2h')
        : await getAllOdds();
    const evBets = calcEV(odds, minEV);
    if (evBets.length > 0) {
        await Cache.set(key, evBets, TTL.ODDS, source);
        memSet(key, evBets, TTL.ODDS);
    }
    return { data: evBets, source };
}
async function getMiddles(minGapPoints = 1, sport = null) {
    const key = `middles:${sport || 'all'}:${minGapPoints}`;
    const mem = memGet(key);
    if (mem)
        return { data: mem, source: 'mem' };
    const cached = await Cache.get(key);
    if (cached) {
        memSet(key, cached, TTL.ODDS);
        return { data: cached, source: 'cache' };
    }
    let odds = [];
    let source = 'api';
    const SPREAD_SPORTS = ['americanfootball_cfl', 'americanfootball_nfl', 'icehockey_nhl'];
    if (sport) {
        const sportKey = getSportKey(sport);
        const markets = ['NHL', 'CFL', 'NFL'].includes(sport) ? ['spreads', 'totals'] : ['totals'];
        const results = await Promise.allSettled(markets.map(m => getOdds(sportKey, m)));
        for (const r of results) {
            if (r.status === 'fulfilled' && r.value.data?.length) {
                odds.push(...r.value.data);
                source = r.value.source;
            }
        }
    }
    else {
        const fetches = [];
        for (const s of SPORTS) {
            if (SPREAD_SPORTS.includes(s))
                fetches.push(getOdds(s, 'spreads'));
            fetches.push(getOdds(s, 'totals'));
        }
        const results = await Promise.allSettled(fetches);
        for (const r of results) {
            if (r.status === 'fulfilled' && r.value.data?.length) {
                odds.push(...r.value.data);
                source = r.value.source;
            }
        }
    }
    const middles = calcMiddles(odds, minGapPoints);
    if (middles.length > 0) {
        await Cache.set(key, middles, TTL.ODDS, source);
        memSet(key, middles, TTL.ODDS);
    }
    return { data: middles, source };
}
async function getBookRankings() {
    const key = 'book-rankings:all';
    const mem = memGet(key);
    if (mem)
        return { data: mem, source: 'mem' };
    const cached = await Cache.get(key);
    if (cached) {
        memSet(key, cached, TTL.ODDS);
        return { data: cached, source: 'cache' };
    }
    const { data: odds, source } = await getAllOdds();
    const rankings = calcBookRanking(odds);
    if (rankings.length > 0) {
        await Cache.set(key, rankings, TTL.ODDS, source);
        memSet(key, rankings, TTL.ODDS);
    }
    return { data: rankings, source };
}
async function getKeyNumberWatch(sport = null) {
    const key = `key-numbers:${sport || 'all'}`;
    const mem = memGet(key);
    if (mem)
        return { data: mem, source: 'mem' };
    const cached = await Cache.get(key);
    if (cached) {
        memSet(key, cached, TTL.ODDS);
        return { data: cached, source: 'cache' };
    }
    let odds = [];
    let source = 'api';
    const SPREAD_SPORTS = ['americanfootball_cfl', 'americanfootball_nfl', 'icehockey_nhl'];
    if (sport) {
        const sportKey = getSportKey(sport);
        const results = await Promise.allSettled([getOdds(sportKey, 'spreads'), getOdds(sportKey, 'totals')]);
        for (const r of results) {
            if (r.status === 'fulfilled' && r.value.data?.length) {
                odds.push(...r.value.data);
                source = r.value.source;
            }
        }
    }
    else {
        const fetches = [];
        for (const s of SPORTS) {
            if (SPREAD_SPORTS.includes(s))
                fetches.push(getOdds(s, 'spreads'));
            fetches.push(getOdds(s, 'totals'));
        }
        const results = await Promise.allSettled(fetches);
        for (const r of results) {
            if (r.status === 'fulfilled' && r.value.data?.length) {
                odds.push(...r.value.data);
                source = r.value.source;
            }
        }
    }
    const flags = calcKeyNumberWatch(odds);
    if (flags.length > 0) {
        await Cache.set(key, flags, TTL.ODDS, source);
        memSet(key, flags, TTL.ODDS);
    }
    return { data: flags, source };
}
async function getNoVig(sport = null) {
    const key = `no-vig:${sport || 'all'}`;
    const mem = memGet(key);
    if (mem)
        return { data: mem, source: 'mem' };
    const cached = await Cache.get(key);
    if (cached) {
        memSet(key, cached, TTL.ODDS);
        return { data: cached, source: 'cache' };
    }
    const { data: odds, source } = sport
        ? await getOdds(getSportKey(sport), 'h2h')
        : await getAllOdds();
    const noVig = calcNoVig(odds);
    if (noVig.length > 0) {
        await Cache.set(key, noVig, TTL.ODDS, source);
        memSet(key, noVig, TTL.ODDS);
    }
    return { data: noVig, source };
}
async function getScores(sport = 'NBA') {
    const key = `scores:${sport}`;
    const mem = memGet(key);
    if (mem)
        return { data: mem, source: 'mem' };
    const cached = await Cache.get(key);
    if (cached) {
        memSet(key, cached, TTL.SCORES);
        return { data: cached, source: 'cache' };
    }
    if (!isKeyConfigured())
        return { data: [], source: 'mock' };
    const sportKey = getSportKey(sport);
    const url = `${ODDS_BASE}/sports/${sportKey}/scores?apiKey=${ODDS_API_KEY}&daysFrom=1`;
    const raw = await fetchJSON(url).catch(() => []);
    const data = (Array.isArray(raw) ? raw : []).slice(0, 20).map(g => ({
        id: g.id,
        sport,
        home: g.home_team,
        away: g.away_team,
        homeScore: g.scores?.find(s => s.name === g.home_team)?.score ?? null,
        awayScore: g.scores?.find(s => s.name === g.away_team)?.score ?? null,
        completed: g.completed,
        time: g.commence_time,
    }));
    await Cache.set(key, data, TTL.SCORES, 'api');
    memSet(key, data, TTL.SCORES);
    return { data, source: 'api' };
}
async function getTeamLogo(teamName) {
    const key = `team:${teamName.toLowerCase().replace(/\s/g, '_')}`;
    const mem = memGet(key);
    if (mem)
        return mem;
    const cached = await Cache.get(key);
    if (cached) {
        memSet(key, cached, TTL.TEAM_META);
        return cached;
    }
    try {
        const data = await fetchJSON(`${SPORTSDB_BASE}/searchteams.php?t=${encodeURIComponent(teamName)}`);
        const team = data?.teams?.[0];
        const result = {
            name: team?.strTeam || teamName,
            logo: team?.strTeamBadge || null,
            league: team?.strLeague || null,
        };
        await Cache.set(key, result, TTL.TEAM_META, 'api');
        memSet(key, result, TTL.TEAM_META);
        return result;
    }
    catch {
        return { name: teamName, logo: null };
    }
}
function getQuotaInfo() {
    return {
        remaining: quotaState.remaining,
        used: quotaState.used,
        lastCheck: quotaState.lastCheck,
        oddsApiConfigured: isKeyConfigured(),
        plan: isKeyConfigured() ? 'paid' : 'unconfigured',
        cacheTTL_seconds: TTL.ODDS,
    };
}
function bustMemCache(prefix = 'odds:*') {
    memDel(prefix);
    memDel('arb:*');
    memDel('ev:*');
}
const SPORT_LABELS = {
    americanfootball_nfl: 'NFL',
    americanfootball_nfl_super_bowl_winner: 'NFL',
    basketball_nba: 'NBA',
    basketball_nba_championship_winner: 'NBA',
    baseball_mlb: 'MLB',
    icehockey_nhl: 'NHL',
    icehockey_nhl_championship_winner: 'NHL',
    soccer_epl: 'Soccer',
    soccer_uefa_champs_league: 'Soccer',
    soccer_uefa_europa_league: 'Soccer',
    soccer_france_ligue_one: 'Soccer',
    soccer_germany_bundesliga: 'Soccer',
    soccer_spain_la_liga: 'Soccer',
    soccer_italy_serie_a: 'Soccer',
    americanfootball_cfl: 'CFL',
    soccer_usa_mls: 'Soccer',
    soccer_canada_cpl: 'Soccer',
    soccer_fifa_world_cup: 'Soccer',
    icehockey_ahl: 'AHL',
    mma_mixed_martial_arts: 'UFC',
    boxing_boxing: 'Boxing',
    tennis_atp_french_open: 'Tennis',
    tennis_wta_french_open: 'Tennis',
    tennis_atp_us_open: 'Tennis',
    tennis_wta_us_open: 'Tennis',
    tennis_atp_wimbledon: 'Tennis',
    tennis_wta_wimbledon: 'Tennis',
};
function transformOdds(games, sportKey, market) {
    const sport = SPORT_LABELS[sportKey] || sportKey;
    const now = Date.now();
    return games
        .filter(game => {
        if (!game.commence_time)
            return true;
        const gameTime = new Date(game.commence_time).getTime();
        return gameTime >= now - 3 * 60 * 60 * 1000;
    })
        .map(game => {
        const allBooks = {};
        const allPoints = {};
        for (const bm of game.bookmakers || []) {
            const mkt = (bm.markets || []).find(m => m.key === market);
            if (!mkt)
                continue;
            for (const outcome of mkt.outcomes) {
                if (!allBooks[outcome.name])
                    allBooks[outcome.name] = {};
                allBooks[outcome.name][bm.key] = outcome.price;
                if (outcome.point !== undefined && outcome.point !== null) {
                    if (!allPoints[outcome.name])
                        allPoints[outcome.name] = {};
                    allPoints[outcome.name][bm.key] = outcome.point;
                }
            }
        }
        const rows = Object.entries(allBooks).map(([selection, books]) => {
            const prices = Object.values(books);
            const bestOdds = Math.max(...prices);
            const bestBook = Object.keys(books).find(k => books[k] === bestOdds) || '';
            const avg = Math.round(prices.reduce((a, b) => a + b, 0) / prices.length);
            return {
                selection,
                bestOdds: bestOdds > 0 ? `+${bestOdds}` : `${bestOdds}`,
                bestBook,
                avgOdds: avg > 0 ? `+${avg}` : `${avg}`,
                books: Object.fromEntries(Object.entries(books).map(([k, v]) => [k, v > 0 ? `+${v}` : `${v}`])),
                points: allPoints[selection] || {},
            };
        });
        return {
            id: game.id,
            game: `${game.home_team} vs ${game.away_team}`,
            sport,
            market: market === 'h2h' ? 'Moneyline' : market === 'spreads' ? 'Spread' : 'Total O/U',
            time: new Date(game.commence_time).toLocaleString('en-US', {
                weekday: 'short', month: 'short', day: 'numeric',
                hour: 'numeric', minute: '2-digit',
            }),
            commenceTime: game.commence_time,
            league: game.sport_title,
            markets: [{ name: market === 'h2h' ? 'Moneyline' : market, rows }],
            isLive: game.commence_time ? new Date(game.commence_time).getTime() <= now : false,
        };
    }).filter(g => g.markets[0].rows.length > 0);
}
function dec(american) {
    if (american >= 100)
        return (american / 100) + 1;
    if (american <= -100)
        return (100 / Math.abs(american)) + 1;
    return 1;
}
function calcArbitrage(games, minProfit = 0) {
    const arbs = [];
    for (const game of games) {
        for (const mkt of game.markets || []) {
            const best = {};
            for (const row of mkt.rows || []) {
                const bestNum = parseInt(row.bestOdds) || 0;
                best[row.selection] = {
                    odds: bestNum, dec: dec(bestNum),
                    book: row.bestBook, display: row.bestOdds,
                };
            }
            const outcomes = Object.entries(best);
            if (outcomes.length < 2)
                continue;
            const impliedSum = outcomes.reduce((s, [, o]) => s + (1 / o.dec), 0);
            if (impliedSum >= 1.0)
                continue;
            const profitPct = ((1 - impliedSum) / impliedSum) * 100;
            if (profitPct < minProfit)
                continue;
            const stake = 1000;
            const legs = outcomes.map(([sel, o]) => ({
                selection: sel,
                book: o.book,
                odds: o.display,
                stake: Math.round((stake / o.dec) / impliedSum * 100) / 100,
                dec: o.dec,
            }));
            arbs.push({
                id: `${game.id}_${mkt.name}`,
                game: game.game,
                sport: game.sport,
                market: mkt.name,
                profit: Math.round(profitPct * 100) / 100,
                legs,
                b1: legs[0]?.book || '',
                b2: legs[1]?.book || '',
                o1: legs[0]?.odds || '',
                o2: legs[1]?.odds || '',
                stake1: legs[0]?.stake || 0,
                stake2: legs[1]?.stake || 0,
                time: game.time,
                ageMin: 0,
                hot: profitPct >= 2.0,
            });
        }
    }
    return arbs.sort((a, b) => b.profit - a.profit);
}
const SHARP_BOOKS = ['pinnacle', 'bet365', 'draftkings', 'fanduel', 'betmgm', 'caesars'];
function getFairOdds(books) {
    for (const sharp of SHARP_BOOKS) {
        const odds = parseInt(books?.[sharp]) || 0;
        if (odds)
            return { fairOdds: odds, sharpBook: sharp };
    }
    const allOdds = Object.values(books || {}).map(o => parseInt(o)).filter(o => o);
    if (allOdds.length < 2)
        return null;
    const avgDec = allOdds.reduce((s, o) => s + dec(o), 0) / allOdds.length;
    const impliedAmerican = avgDec >= 2
        ? Math.round((avgDec - 1) * 100)
        : Math.round(-100 / (avgDec - 1));
    return { fairOdds: impliedAmerican, sharpBook: 'market_avg' };
}
function calcEV(games, minEV = 0) {
    const evBets = [];
    for (const game of games) {
        for (const mkt of game.markets || []) {
            for (const row of mkt.rows || []) {
                const fair = getFairOdds(row.books);
                if (!fair)
                    continue;
                const { fairOdds, sharpBook } = fair;
                const fairDec = dec(fairOdds);
                const trueProb = 1 / fairDec;
                for (const [bookKey, oddsStr] of Object.entries(row.books || {})) {
                    if (bookKey === sharpBook)
                        continue;
                    const bookOdds = parseInt(oddsStr) || 0;
                    if (!bookOdds)
                        continue;
                    const bookDec = dec(bookOdds);
                    const ev = (trueProb * bookDec - 1) * 100;
                    if (ev < minEV)
                        continue;
                    if (ev > 30)
                        continue;
                    const b = bookDec - 1;
                    const q = 1 - trueProb;
                    const kelly = Math.max(0, (b * trueProb - q) / b) * 100;
                    evBets.push({
                        id: `${game.id}_${bookKey}_${row.selection}`,
                        game: game.game,
                        sport: game.sport,
                        league: game.league || '',
                        market: `${mkt.name} — ${row.selection}`,
                        ev: Math.round(ev * 100) / 100,
                        bookOdds: bookOdds > 0 ? `+${bookOdds}` : `${bookOdds}`,
                        fairOdds: fairOdds > 0 ? `+${fairOdds}` : `${fairOdds}`,
                        book: bookKey,
                        prob: `${(trueProb * 100).toFixed(1)}%`,
                        kelly: Math.round(kelly * 10) / 10,
                        size: Math.round(kelly * 0.25 * 100) / 100,
                        time: game.time,
                    });
                }
            }
        }
    }
    return evBets.sort((a, b) => b.ev - a.ev);
}
function calcMiddles(games, minGapPoints = 1) {
    const middles = [];
    for (const game of games) {
        for (const mkt of game.markets || []) {
            const rows = mkt.rows || [];
            if (rows.length !== 2)
                continue;
            const [rowA, rowB] = rows;
            const pointsA = rowA.points || {};
            const pointsB = rowB.points || {};
            if (!Object.keys(pointsA).length || !Object.keys(pointsB).length)
                continue;
            let best = null;
            for (const [bookA, ptA] of Object.entries(pointsA)) {
                for (const [bookB, ptB] of Object.entries(pointsB)) {
                    if (bookA === bookB)
                        continue;
                    const gap = ptA + ptB;
                    if (gap > 0 && (!best || gap > best.gap)) {
                        best = { gap, bookA, bookB, pointA: ptA, pointB: ptB };
                    }
                }
            }
            if (best && best.gap >= minGapPoints) {
                middles.push({
                    id: `${game.id}_${mkt.name}_middle`,
                    game: game.game,
                    sport: game.sport,
                    league: game.league || '',
                    market: mkt.name,
                    gap: Math.round(best.gap * 100) / 100,
                    legA: {
                        selection: rowA.selection, book: best.bookA,
                        point: best.pointA, odds: rowA.books[best.bookA],
                    },
                    legB: {
                        selection: rowB.selection, book: best.bookB,
                        point: best.pointB, odds: rowB.books[best.bookB],
                    },
                    time: game.time,
                    hot: best.gap >= 3,
                });
            }
        }
    }
    return middles.sort((a, b) => b.gap - a.gap);
}
function calcBookRanking(games) {
    const bookMargins = {};
    for (const game of games) {
        for (const mkt of game.markets || []) {
            const rows = mkt.rows || [];
            if (rows.length < 2)
                continue;
            const bookSets = rows.map(r => new Set(Object.keys(r.books || {})));
            const commonBooks = [...bookSets[0]].filter(b => bookSets.every(s => s.has(b)));
            for (const book of commonBooks) {
                const impliedSum = rows.reduce((s, r) => {
                    const odds = parseInt(r.books[book]) || 0;
                    return s + (odds ? 1 / dec(odds) : 0);
                }, 0);
                if (!impliedSum)
                    continue;
                const marginPct = (impliedSum - 1) * 100;
                if (!bookMargins[book])
                    bookMargins[book] = { sum: 0, count: 0 };
                bookMargins[book].sum += marginPct;
                bookMargins[book].count += 1;
            }
        }
    }
    return Object.entries(bookMargins)
        .filter(([, v]) => v.count >= 3)
        .map(([book, v]) => ({
        book,
        avgMargin: Math.round((v.sum / v.count) * 100) / 100,
        sampleSize: v.count,
    }))
        .sort((a, b) => a.avgMargin - b.avgMargin);
}
const KEY_NUMBERS = {
    NFL: [3, 7, 10, 6, 4],
    CFL: [3, 7, 10],
    NBA: [],
    NHL: [1, 2],
    MLB: [1, 1.5],
};
function calcKeyNumberWatch(games) {
    const flags = [];
    for (const game of games) {
        const keyNums = KEY_NUMBERS[game.sport] || [];
        if (!keyNums.length)
            continue;
        for (const mkt of game.markets || []) {
            for (const row of mkt.rows || []) {
                for (const [book, point] of Object.entries(row.points || {})) {
                    const abs = Math.abs(point);
                    for (const key of keyNums) {
                        const dist = Math.abs(abs - key);
                        if (dist <= 0.5) {
                            flags.push({
                                id: `${game.id}_${mkt.name}_${row.selection}_${book}`,
                                game: game.game,
                                sport: game.sport,
                                market: mkt.name,
                                selection: row.selection,
                                book,
                                point,
                                keyNumber: key,
                                distance: Math.round(dist * 10) / 10,
                                onNumber: dist === 0,
                                odds: row.books[book],
                                time: game.time,
                            });
                            break;
                        }
                    }
                }
            }
        }
    }
    return flags.sort((a, b) => a.distance - b.distance);
}
function calcNoVig(games) {
    const out = [];
    for (const game of games) {
        for (const mkt of game.markets || []) {
            for (const row of mkt.rows || []) {
                const fair = getFairOdds(row.books);
                if (!fair)
                    continue;
                const { fairOdds, sharpBook } = fair;
                const trueProb = 1 / dec(fairOdds);
                out.push({
                    id: `${game.id}_${mkt.name}_${row.selection}`,
                    game: game.game,
                    sport: game.sport,
                    market: mkt.name,
                    selection: row.selection,
                    fairOdds: fairOdds > 0 ? `+${fairOdds}` : `${fairOdds}`,
                    fairProb: `${(trueProb * 100).toFixed(1)}%`,
                    sharpBook,
                    books: row.books,
                    time: game.time,
                });
            }
        }
    }
    return out;
}
function getSportKey(label) {
    const map = {
        NFL: 'americanfootball_nfl',
        CFL: 'americanfootball_cfl',
        NBA: 'basketball_nba',
        MLB: 'baseball_mlb',
        NHL: 'icehockey_nhl',
        AHL: 'icehockey_ahl',
        Soccer: 'soccer_usa_mls',
        UFC: 'mma_mixed_martial_arts',
        Tennis: 'tennis_atp_french_open',
    };
    return map[label] || 'baseball_mlb';
}
function getMockSports() {
    return [
        { key: 'americanfootball_nfl', title: 'NFL', active: true },
        { key: 'americanfootball_cfl', title: 'CFL', active: true },
        { key: 'basketball_nba', title: 'NBA', active: true },
        { key: 'baseball_mlb', title: 'MLB', active: true },
        { key: 'icehockey_nhl', title: 'NHL', active: true },
        { key: 'icehockey_ahl', title: 'AHL', active: true },
        { key: 'soccer_usa_mls', title: 'MLS Soccer', active: true },
        { key: 'soccer_canada_cpl', title: 'CPL Soccer', active: true },
        { key: 'mma_mixed_martial_arts', title: 'UFC/MMA', active: true },
    ];
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
    bustMemCache,
    getMiddles,
    getBookRankings,
    getKeyNumberWatch,
    getNoVig,
};
