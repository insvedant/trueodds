

export const SPORTS = ['All', 'NFL', 'CFL', 'NBA', 'MLB', 'NHL', 'UFC', 'Soccer', 'Tennis']

export const BOOK_ABBR: Record<string, string> = {
  DraftKings:  'DK',   draftkings:  'DK',
  FanDuel:     'FD',   fanduel:     'FD',
  BetMGM:      'MGM',  betmgm:      'MGM',
  Caesars:     'CZ',   caesars:     'CZ',
  PointsBet:   'PB',   pointsbet:   'PB',
  Bet365:      'B3',   bet365:      'B3',
  Pinnacle:    'PIN',  pinnacle:    'PIN',
  Bovada:      'BOV',  bovada:      'BOV',
  Barstool:    'BAR',  barstool:    'BAR',
  '1XBet':     '1X',
  ESPNBet:     'ESPN', espnbet:     'ESPN',
  Fliff:       'FL',
  SuperBook:   'SB',   superbook:   'SB',
  LowVig:      'LV',   lowvig:      'LV',
  BetOnline:   'BOL',  betonlineag: 'BOL',
  MyBookie:    'MB',   mybookieag:  'MB',
}

export const BOOK_COLOR: Record<string, string> = {
  DraftKings:  '#003087', draftkings:  '#003087',
  FanDuel:     '#1493ff', fanduel:     '#1493ff',
  BetMGM:      '#c9a84c', betmgm:      '#c9a84c',
  Caesars:     '#006400', caesars:     '#006400',
  PointsBet:   '#ff6b00', pointsbet:   '#ff6b00',
  Bet365:      '#cc0000', bet365:      '#cc0000',
  Pinnacle:    '#8b0000', pinnacle:    '#8b0000',
  Bovada:      '#d40000', bovada:      '#d40000',
  Barstool:    '#000000', barstool:    '#000000',
  '1XBet':     '#cc0000',
  ESPNBet:     '#d00000', espnbet:     '#d00000',
  Fliff:       '#7c3aed',
  SuperBook:   '#003366', superbook:   '#003366',
  LowVig:      '#065f46', lowvig:      '#065f46',
  BetOnline:   '#1a1a2e', betonlineag: '#1a1a2e',
  MyBookie:    '#b45309', mybookieag:  '#b45309',
}

export type ArbBet = {
  id: string | number
  game: string
  sport: string
  market: string
  profit: number
  b1: string
  b2: string
  o1: string | number
  o2: string | number
  stake1: number
  stake2: number
  time?: string
  ageMin?: number
  hot?: boolean
  legs?: any[]
}

export type EVBet = {
  id: string
  game: string
  sport: string
  league?: string
  market: string
  ev: number
  bookOdds: string
  fairOdds: string
  book: string
  prob: string
  kelly?: number
  size?: number
  time?: string
}

export type OddsRow = {
  selection: string
  bestOdds: string
  bestBook: string
  avgOdds: string
  books: Record<string, string>
}

export type OddsGame = {
  id: string
  game: string
  sport: string
  market: string
  time: string
  league?: string
  markets: Array<{ name: string; rows: OddsRow[] }>
}

export const BOOK_URLS: Record<string, string> = {
  // ── USA ────────────────────────────────────────────────
  DraftKings:           'https://sportsbook.draftkings.com',
  draftkings:           'https://sportsbook.draftkings.com',
  draftkings_ca:        'https://sportsbook.draftkings.com',
  FanDuel:              'https://sportsbook.fanduel.com',
  fanduel:              'https://sportsbook.fanduel.com',
  fanduel_ca:           'https://sportsbook.fanduel.com',
  BetMGM:               'https://sports.betmgm.com',
  betmgm:               'https://sports.betmgm.com',
  betmgm_ca:            'https://sports.betmgm.com',
  Caesars:              'https://sportsbook.caesars.com',
  caesars:              'https://sportsbook.caesars.com',
  'Caesars Sportsbook': 'https://sportsbook.caesars.com',
  'Fanatics Sportsbook':'https://sportsbook.fanatics.com',
  fanatics:             'https://sportsbook.fanatics.com',
  BetRivers:            'https://www.betrivers.com',
  betrivers:            'https://www.betrivers.com',
  'Hard Rock Bet':      'https://www.hardrock.bet',
  hardrock:             'https://www.hardrock.bet',
  'ESPN Bet':           'https://espnbet.com',
  espnbet:              'https://espnbet.com',
  Pinnacle:             'https://www.pinnacle.com',
  pinnacle:             'https://www.pinnacle.com',
  pinnacle_us:          'https://www.pinnacle.com',
  PointsBet:            'https://pointsbet.com',
  pointsbet:            'https://pointsbet.com',
  pointsbet_us:         'https://pointsbet.com',
  Bet365:               'https://www.bet365.com',
  bet365:               'https://www.bet365.com',
  bet365_us:            'https://www.bet365.com',
  bet365_ca:            'https://www.bet365.com',
  'William Hill':       'https://www.williamhill.com',
  williamhill:          'https://www.williamhill.com',
  williamhill_us:       'https://www.williamhill.com',
  Bovada:               'https://www.bovada.lv',
  bovada:               'https://www.bovada.lv',
  BetOnline:            'https://www.betonline.ag',
  betonlineag:          'https://www.betonline.ag',
  betonline:            'https://www.betonline.ag',
  Barstool:             'https://www.barstoolsportsbook.com',
  barstool:             'https://www.barstoolsportsbook.com',
  Unibet:               'https://www.unibet.com',
  unibet:               'https://www.unibet.com',
  unibet_us:            'https://www.unibet.com',
  unibet_ca:            'https://www.unibet.ca',
  '888sport':           'https://www.888sport.com',
  Betway:               'https://betway.com',
  betway:               'https://betway.com',
  // ── CANADA ────────────────────────────────────────────
  ToonieBet:            'https://www.tooniebet.com',
  tooniebet:            'https://www.tooniebet.com',
  'Sports Interaction': 'https://www.sportsinteraction.com',
  si:                   'https://www.sportsinteraction.com',
  sportsinteraction:    'https://www.sportsinteraction.com',
  'PlayNow.com':        'https://www.playnow.com',
  playnow:              'https://www.playnow.com',
  TonyBet:              'https://www.tonybet.com',
  tonybet:              'https://www.tonybet.com',
  pointsbet_ca:         'https://pointsbet.ca',
  'PointsBet Canada':   'https://pointsbet.ca',
}

export function getBookUrl(book: string): string {
  if (!book) return '#'
  
  if (BOOK_URLS[book]) return BOOK_URLS[book]
  
  const lower = book.toLowerCase().replace(/\s+/g, '')
  for (const [key, url] of Object.entries(BOOK_URLS)) {
    if (key.toLowerCase().replace(/\s+/g, '') === lower) return url
  }
  
  return `https://www.google.com/search?q=${encodeURIComponent(book + ' sportsbook')}`
}

export async function fetchAffiliateUrls(source?: string): Promise<Record<string, string>> {
  try {
    const params = source ? `?source=${source}` : ''
    const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/affiliates/public${params}`)
    const data = await res.json()
    if (data.books) {
      const urls: Record<string, string> = {}
      Object.entries(data.books).forEach(([id, info]: [string, any]) => {
        urls[id]             = info.url
        urls[id.toLowerCase()] = info.url
        urls[info.displayName] = info.url
        urls[info.displayName.toLowerCase()] = info.url
      })
      return urls
    }
  } catch {}
  return {}
}

export async function trackAndOpen(sportsbook: string, source: string) {
  try {
    const id  = sportsbook.toLowerCase().replace(/\s+/g, '')
    const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/affiliates/click/${id}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ source }),
    })
    const data = await res.json()
    if (data.url) { window.open(data.url, '_blank'); return }
  } catch {}
  window.open(getBookUrl(sportsbook), '_blank')
}
