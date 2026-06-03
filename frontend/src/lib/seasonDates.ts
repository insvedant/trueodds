export type SeasonStatus = 'active' | 'off_season' | 'playoffs' | 'preseason'

export interface LeagueInfo {
  name: string
  status: SeasonStatus
  message: string
  nextData: string
  emoji: string
}

const now = new Date()
const month = now.getMonth() + 1
const day = now.getDate()

function inRange(startM: number, startD: number, endM: number, endD: number): boolean {
  const cur = month * 100 + day
  const start = startM * 100 + startD
  const end   = endM * 100 + endD
  if (start <= end) return cur >= start && cur <= end
  return cur >= start || cur <= end
}

export const LEAGUE_SEASONS: Record<string, LeagueInfo> = {
  NFL: {
    name: 'NFL',
    emoji: '🏈',
    ...(inRange(9,1,2,15)
      ? { status:'active',     message:'NFL season is live.',              nextData:'' }
      : inRange(8,1,8,31)
      ? { status:'preseason',  message:'NFL preseason starting soon.',     nextData:'Preseason starts August 2026' }
      : { status:'off_season', message:'NFL season ended. No games until September.', nextData:'Regular season returns September 2026' }),
  },
  CFL: {
    name: 'CFL',
    emoji: '🏈',
    ...(inRange(6,1,11,30)
      ? { status:'active',     message:'CFL season is live.',              nextData:'' }
      : { status:'off_season', message:'CFL season hasn\'t started yet. Season runs June–November.', nextData:'First games expected June 2026' }),
  },
  NBA: {
    name: 'NBA',
    emoji: '🏀',
    ...(inRange(10,1,6,20)
      ? { status:'active',     message:'NBA season is live.',              nextData:'' }
      : { status:'off_season', message:'NBA season ended. No games until October.', nextData:'New season starts October 2026' }),
  },
  MLB: {
    name: 'MLB',
    emoji: '⚾',
    ...(inRange(3,20,10,31)
      ? { status:'active',     message:'MLB season is live.',              nextData:'' }
      : { status:'off_season', message:'MLB offseason. No games until late March.', nextData:'Spring training starts February 2027' }),
  },
  NHL: {
    name: 'NHL',
    emoji: '🏒',
    ...(inRange(4,18,6,24)
      ? { status:'active', message:'🔥 NHL Stanley Cup Playoffs are live! Odds appear between games — if empty, the next game may not be listed yet. Stanley Cup Final starts June 4.', nextData:'' }
      : inRange(10,1,4,17)
      ? { status:'active', message:'NHL regular season is live.', nextData:'' }
      : { status:'off_season', message:'NHL season ended. New season starts October 2026.', nextData:'New season starts October 2026' }),
  },
  AHL: {
    name: 'AHL',
    emoji: '🏒',
    ...(inRange(10,1,6,15)
      ? { status:'active',     message:'AHL season is live.',              nextData:'' }
      : { status:'off_season', message:'AHL season ended. Returns in October.', nextData:'New season starts October 2026' }),
  },
  UFC: {
    name: 'UFC',
    emoji: '🥊',
    status: 'active',
    message: 'UFC events run year-round.',
    nextData: '',
  },
  Tennis: {
    name: 'Tennis',
    emoji: '🎾',
    status: 'active',
    message: 'Tennis events run year-round.',
    nextData: '',
  },
}

export const SOCCER_LEAGUE_SEASONS: Record<string, LeagueInfo> = {
  'All': { name:'All Soccer', emoji:'⚽', status:'active', message:'', nextData:'' },
  'Friendlies': {
    name:'International Friendlies', emoji:'🌍',
    status: inRange(6,1,7,31) ? 'active' : 'off_season',
    message: inRange(6,1,7,31) ? 'International friendlies are active.' : 'Friendlies window not currently active.',
    nextData: 'FIFA World Cup starts June 11, 2026',
  },
  'FIFA': {
    name:'FIFA World Cup', emoji:'🏆',
    status: inRange(6,11,7,19) ? 'active' : 'off_season',
    message: inRange(6,11,7,19) ? '🔥 FIFA World Cup 2026 is live!' : 'FIFA World Cup 2026 hasn\'t started yet.',
    nextData: 'World Cup starts June 11, 2026 in USA/Canada/Mexico',
  },
  'Champions': {
    name:'UEFA Champions League', emoji:'⭐',
    status: inRange(9,1,5,31) ? 'active' : 'off_season',
    message: (month === 5 && day >= 28 && month <= 5)
      ? '🔥 UCL Final TOMORROW — Arsenal vs PSG, May 30 in Budapest! Odds may appear within hours of kickoff.'
      : inRange(9,1,5,31) ? 'Champions League is active.' : 'Champions League season ended. Final was May 30, 2026.',
    nextData: 'New season qualifiers start July 7, 2026 · Group stage September 2026',
  },
  'Europa': {
    name:'UEFA Europa League', emoji:'🟠',
    status: inRange(9,1,5,25) ? 'active' : 'off_season',
    message: inRange(9,1,5,25) ? 'Europa League is active.' : 'Europa League season ended May 20. Showing recent matches where available.',
    nextData: 'New season starts September 2026',
  },
  'EPL': {
    name:'English Premier League', emoji:'🏴󠁧󠁢󠁥󠁮󠁧󠁿',
    status: inRange(8,1,5,31) ? 'active' : 'off_season',
    message: inRange(8,1,5,31) ? 'EPL is active.' : '2025-26 season ended May 2026. Showing recent completed matches.',
    nextData: 'New season starts August 22, 2026',
  },
  'Bundesliga': {
    name:'German Bundesliga', emoji:'🇩🇪',
    status: inRange(8,1,5,31) ? 'active' : 'off_season',
    message: inRange(8,1,5,31) ? 'Bundesliga is active.' : 'Bundesliga season ended. Summer break.',
    nextData: 'New season starts August 9, 2026',
  },
  'La Liga': {
    name:'La Liga', emoji:'🇪🇸',
    status: inRange(8,1,5,31) ? 'active' : 'off_season',
    message: inRange(8,1,5,31) ? 'La Liga is active.' : 'La Liga season ended May 24. Summer break.',
    nextData: 'New season starts August 2026',
  },
  'Serie A': {
    name:'Serie A', emoji:'🇮🇹',
    status: inRange(8,1,5,31) ? 'active' : 'off_season',
    message: inRange(8,1,5,31) ? 'Serie A is active.' : '2025-26 season ended May 2026. Showing recent completed matches.',
    nextData: 'New season starts August 2026',
  },
  'Ligue 1': {
    name:'Ligue 1', emoji:'🇫🇷',
    status: inRange(8,1,5,31) ? 'active' : 'off_season',
    message: inRange(8,1,5,31) ? 'Ligue 1 is active.' : '2025-26 season ended May 2026. Showing recent completed matches.',
    nextData: 'New season starts August 2026',
  },
  'MLS': {
    name:'MLS', emoji:'🇺🇸',
    status: inRange(2,22,11,30) ? 'active' : 'off_season',
    message: inRange(2,22,11,30) ? 'MLS season is live.' : 'MLS season ended. Returns in February.',
    nextData: 'New season starts February 2027',
  },
  'CPL': {
    name:'Canadian Premier League', emoji:'🇨🇦',
    status: inRange(4,1,10,31) ? 'active' : 'off_season',
    message: inRange(4,1,10,31) ? 'CPL season is live.' : 'CPL season not active.',
    nextData: 'Season runs April–October',
  },
  'Brazil': {
    name:'Brasileirao', emoji:'🇧🇷',
    status: inRange(4,1,12,15) ? 'active' : 'off_season',
    message: inRange(4,1,12,15) ? 'Brasileirao is active.' : 'Brasileirao not currently active.',
    nextData: 'Season runs April–December',
  },
  'Argentina': {
    name:'Argentine Primera', emoji:'🇦🇷',
    status: inRange(2,1,6,30) || inRange(7,1,12,15) ? 'active' : 'off_season',
    message: 'Argentine Primera runs two tournaments per year.',
    nextData: 'Next tournament starts July 2026',
  },
}

export function getSeasonInfo(sport: string, soccerLeague?: string): LeagueInfo | null {
  if (sport === 'Soccer' && soccerLeague && soccerLeague !== 'All') {
    return SOCCER_LEAGUE_SEASONS[soccerLeague] || null
  }
  return LEAGUE_SEASONS[sport] || null
}
