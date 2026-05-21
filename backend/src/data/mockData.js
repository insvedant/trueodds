const BOOKS = ['DraftKings','FanDuel','BetMGM','Caesars','PointsBet','Bet365','Pinnacle']
const GAMES = [
  { game:'Kansas City Chiefs vs Baltimore Ravens', sport:'NFL', time:'Sun 1:00 PM' },
  { game:'Los Angeles Lakers vs Boston Celtics', sport:'NBA', time:'Fri 7:30 PM' },
  { game:'New York Yankees vs Boston Red Sox', sport:'MLB', time:'Fri 7:05 PM' },
  { game:'Toronto Maple Leafs vs Montreal Canadiens', sport:'NHL', time:'Fri 7:00 PM' },
  { game:'Jon Jones vs Stipe Miocic', sport:'UFC', time:'Sat Main Card' },
  { game:'Manchester City vs Arsenal', sport:'Soccer', time:'Sat 12:30 PM' },
]

function r() { const p=[-110,-115,-108,-105,+100,+105,+110,-120]; return p[Math.floor(Math.random()*p.length)] }

function generateOdds(sport) {
  const games = sport ? GAMES.filter(g => g.sport===sport) : GAMES
  return games.flatMap((g,gi) =>
    ['Moneyline','Spread','Total O/U'].map((market,mi) => {
      const bookOdds = Object.fromEntries(BOOKS.map(b => [b, r()]))
      const best = Math.max(...Object.values(bookOdds))
      return { id:`${gi}-${mi}`, game:g.game, sport:g.sport, market, time:g.time,
        bestOdds:best, bestBook:BOOKS.find(b=>bookOdds[b]===best), books:bookOdds, updatedAt:new Date() }
    })
  )
}

function generateArbitrage(minProfit=0) {
  return GAMES.slice(0,6).map((g,i) => ({
    id:`arb-${i}`, game:g.game, sport:g.sport, market:'Moneyline',
    profitPct: +(Math.random()*4+0.5).toFixed(2),
    legs: [
      { book:BOOKS[Math.floor(Math.random()*BOOKS.length)], selection:g.game.split(' vs ')[0], odds:r(), stake:480+Math.round(Math.random()*40) },
      { book:BOOKS[Math.floor(Math.random()*BOOKS.length)], selection:g.game.split(' vs ')[1], odds:r(), stake:520-Math.round(Math.random()*40) },
    ], updatedAt:new Date()
  })).filter(a=>a.profitPct>=minProfit)
}

function generateEV(minEV=0, sport) {
  const games = sport ? GAMES.filter(g=>g.sport===sport) : GAMES
  return games.map((g,i) => ({
    id:`ev-${i}`, game:g.game, sport:g.sport, market:'Moneyline',
    book:BOOKS[Math.floor(Math.random()*BOOKS.length)],
    bookOdds:r(), trueOdds:r(),
    ev:+(Math.random()*9+2).toFixed(1),
    edge:+(Math.random()*5+1).toFixed(1),
    kelly:+(Math.random()*3+0.5).toFixed(1),
    updatedAt:new Date()
  })).filter(b=>b.ev>=minEV)
}

module.exports = { generateOdds, generateArbitrage, generateEV }
