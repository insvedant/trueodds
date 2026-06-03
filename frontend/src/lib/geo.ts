export type Market = 'US' | 'CA'

export const US_STATES = [
  { code:'NY', name:'New York' },    { code:'NJ', name:'New Jersey' },
  { code:'PA', name:'Pennsylvania' },{ code:'IL', name:'Illinois' },
  { code:'OH', name:'Ohio' },        { code:'MI', name:'Michigan' },
  { code:'CO', name:'Colorado' },    { code:'AZ', name:'Arizona' },
  { code:'IN', name:'Indiana' },     { code:'VA', name:'Virginia' },
  { code:'TN', name:'Tennessee' },   { code:'IA', name:'Iowa' },
  { code:'WV', name:'West Virginia' },{ code:'MS', name:'Mississippi' },
  { code:'LA', name:'Louisiana' },   { code:'KS', name:'Kansas' },
  { code:'MD', name:'Maryland' },    { code:'MA', name:'Massachusetts' },
  { code:'CT', name:'Connecticut' }, { code:'OR', name:'Oregon' },
  { code:'WY', name:'Wyoming' },     { code:'MO', name:'Missouri' },
  { code:'ON', name:'Ontario (CA)' },{ code:'CA_OTHER', name:'Other Canada' },
]

export const SPORTSBOOKS_BY_STATE: Record<string, string[]> = {
  // ── US States ──────────────────────────────────────────────────────────
  NY:  ['fanduel','draftkings','betmgm','caesars','betrivers','espnbet','fanatics','pointsbet'],
  NJ:  ['fanduel','draftkings','betmgm','caesars','betrivers','pointsbet','unibet','barstool','fanatics'],
  PA:  ['fanduel','draftkings','betmgm','caesars','betrivers','pointsbet','unibet','barstool','fanatics'],
  IL:  ['fanduel','draftkings','betmgm','caesars','betrivers','pointsbet','barstool','fanatics'],
  OH:  ['fanduel','draftkings','betmgm','caesars','betrivers','pointsbet','hardrockbet','fanatics'],
  MI:  ['fanduel','draftkings','betmgm','caesars','betrivers','pointsbet','barstool','fanatics'],
  CO:  ['fanduel','draftkings','betmgm','caesars','betrivers','pointsbet','barstool','fanatics'],
  AZ:  ['fanduel','draftkings','betmgm','caesars','betrivers','barstool','hardrockbet','espnbet'],
  IN:  ['fanduel','draftkings','betmgm','caesars','betrivers','pointsbet','barstool'],
  VA:  ['fanduel','draftkings','betmgm','caesars','betrivers','pointsbet','barstool','espnbet'],
  TN:  ['fanduel','draftkings','betmgm','caesars','betrivers','pointsbet'],
  MA:  ['fanduel','draftkings','betmgm','caesars','betrivers','espnbet','fanatics'],
  MD:  ['fanduel','draftkings','betmgm','caesars','betrivers','pointsbet','fanatics'],
  CT:  ['fanduel','draftkings','betmgm','caesars','betrivers'],
  IA:  ['fanduel','draftkings','betmgm','caesars','betrivers','pointsbet'],
  // ── Canada ────────────────────────────────────────────────────────────
  ON:  ['bet365','draftkings','fanduel','betmgm','sports_interaction','pointsbet','pinnacle','tooniebet','tonybet','unibet'],
  CA_OTHER: ['bet365','pinnacle','sports_interaction','playnow','tooniebet','tonybet','draftkings','fanduel','pointsbet'],
}

export async function detectMarket(): Promise<{ market: Market; countryCode: string }> {
  try {
    const r = await fetch('https://ipapi.co/json/', { signal: AbortSignal.timeout(3000) })
    const d = await r.json()
    const market: Market = d.country_code === 'CA' ? 'CA' : 'US'
    return { market, countryCode: d.country_code }
  } catch {
    return { market: 'US', countryCode: 'US' }
  }
}

export function getMarketFromStorage(): { market: Market; state: string } | null {
  try {
    const raw = localStorage.getItem('trueodds_market')
    return raw ? JSON.parse(raw) : null
  } catch { return null }
}

export function saveMarketToStorage(market: Market, state: string) {
  try {
    localStorage.setItem('trueodds_market', JSON.stringify({ market, state }))
  } catch {}
}

export function getAvailableSportsbooks(state: string): string[] {
  return SPORTSBOOKS_BY_STATE[state] || SPORTSBOOKS_BY_STATE['NY']
}
