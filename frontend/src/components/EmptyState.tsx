'use client'
import { getSeasonInfo } from '@/lib/seasonDates'

interface Props {
  sport: string
  soccerLeague?: string
  type: 'arb' | 'ev' | 'odds'
  minValue?: number
}

export default function EmptyState({ sport, soccerLeague, type, minValue }: Props) {
  const info = getSeasonInfo(sport, soccerLeague)

  if (info) {
    if (info.status === 'off_season' || info.status === 'preseason') {
      return (
        <div style={{ textAlign:'center', padding:'clamp(32px,6vw,56px) 24px', background:'var(--bg3)', border:'1px solid var(--border)', borderRadius:12 }}>
          <div style={{ fontSize:40, marginBottom:12 }}>{info.emoji}</div>
          <div style={{ fontWeight:800, fontSize:16, marginBottom:8, color:'var(--text)' }}>
            {info.name} — {info.status === 'preseason' ? 'Preseason' : 'Off Season'}
          </div>
          <p style={{ color:'var(--muted)', fontSize:14, lineHeight:1.7, maxWidth:440, margin:'0 auto 14px' }}>
            {info.message}
          </p>
          {info.message.includes('recent') && (
            <div style={{ background:'rgba(240,165,0,0.08)', border:'1px solid rgba(240,165,0,0.2)', borderRadius:8, padding:'8px 14px', fontSize:13, color:'#f0a500', marginBottom:12, maxWidth:400, margin:'0 auto 12px' }}>
              📅 Displaying recent completed matches — odds may be limited
            </div>
          )}
          {info.nextData && (
            <div style={{ display:'inline-flex', alignItems:'center', gap:8, background:'rgba(59,130,246,0.08)', border:'1px solid rgba(59,130,246,0.2)', borderRadius:10, padding:'8px 16px', fontSize:13, color:'#3b82f6', fontWeight:600 }}>
              🗓 {info.nextData}
            </div>
          )}
        </div>
      )
    }

    if (info.status === 'active' && info.message) {
      // Active season but no arb/EV found right now
      return (
        <div style={{ textAlign:'center', padding:'clamp(32px,6vw,56px) 24px', background:'var(--bg3)', border:'1px solid var(--border)', borderRadius:12 }}>
          <div style={{ fontSize:40, marginBottom:12 }}>{info.emoji}</div>
          <div style={{ fontWeight:800, fontSize:15, marginBottom:10, color:'var(--text)' }}>
            {info.name} — No opportunities right now
          </div>
          <p style={{ color:'var(--muted)', fontSize:13, lineHeight:1.7, maxWidth:460, margin:'0 auto 14px' }}>
            {info.message}
          </p>
          <div style={{ display:'inline-flex', alignItems:'center', gap:8, background:'rgba(0,200,83,0.08)', border:'1px solid rgba(0,200,83,0.2)', borderRadius:10, padding:'8px 16px', fontSize:13, color:'var(--green)', fontWeight:600 }}>
            🔄 Try hitting Refresh or check back in a few minutes
          </div>
        </div>
      )
    }
  }

  const noDataMsg = type === 'arb'
    ? `No arbitrage bets found${minValue ? ` above ${minValue}%` : ''}. Try lowering the minimum or check back soon.`
    : type === 'ev'
    ? `No +EV bets found${minValue ? ` above ${minValue}%` : ''}. Try lowering the threshold or check back soon.`
    : 'No games found. Try refreshing or selecting All.'

  return (
    <div style={{ textAlign:'center', padding:'clamp(32px,6vw,56px) 24px', background:'var(--bg3)', border:'1px solid var(--border)', borderRadius:12 }}>
      <div style={{ fontSize:36, marginBottom:12, opacity:0.3 }}>
        {sport === 'Soccer' ? '⚽' : sport === 'NFL' || sport === 'CFL' ? '🏈' : sport === 'NBA' ? '🏀' : sport === 'MLB' ? '⚾' : sport === 'NHL' ? '🏒' : sport === 'UFC' ? '🥊' : sport === 'Tennis' ? '🎾' : '📊'}
      </div>
      <p style={{ color:'var(--dim)', fontSize:14, lineHeight:1.6 }}>{noDataMsg}</p>
    </div>
  )
}
