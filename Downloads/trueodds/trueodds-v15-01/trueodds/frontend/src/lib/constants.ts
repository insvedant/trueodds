/**
 * constants.ts
 * UI constants only — book colors, abbreviations, sport labels.
 * Zero hardcoded betting data. All real data comes from the backend API.
 */

export const SPORTS = ['All', 'NFL', 'NBA', 'MLB', 'NHL', 'UFC', 'Soccer', 'Tennis']

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

// Types for API responses
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
