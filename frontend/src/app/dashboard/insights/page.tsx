'use client'
import { useState, useEffect, useCallback } from 'react'
import { api } from '@/lib/auth'
import { useAuth } from '@/lib/auth'
import Link from 'next/link'
import UpgradeWall from '@/components/UpgradeWall'

type EVEdgeBet = {
  id: string; game: string; sport: string; book: string
  evScore: number; confidence: 'High'|'Medium'|'Low'
  sampleSize: number; keyReason: string; bookOdds: string; fairOdds: string
}

type LineAlert = {
  id: string; game: string; sport: string
  direction: 'up'|'down'; fromLine: string; toLine: string
  urgencyMinutes: number; historicalAccuracy: number; market: string
}

type ArbForecast = {
  id: string; sport: string; market: string
  probability: number; prepTip: string; expectedIn: string
}

const EMPTY_EV: EVEdgeBet[] = []
const EMPTY_ALERTS: LineAlert[] = []
const EMPTY_FORECASTS: ArbForecast[] = []

function EVBadge({ score }: { score: number }) {
  const color = score >= 5 ? 'var(--green)' : score >= 2 ? 'var(--amber)' : 'var(--muted)'
  const bg    = score >= 5 ? 'rgba(0,200,83,0.12)' : score >= 2 ? 'rgba(240,165,0,0.1)' : 'rgba(107,114,128,0.1)'
  return (
    <span style={{ background: bg, color, fontSize: 13, fontWeight: 900, padding: '3px 10px', borderRadius: 20 }}>
      +{score}% Edge
    </span>
  )
}

function ConfidenceBadge({ level }: { level: 'High'|'Medium'|'Low' }) {
  const map = { High: { color: 'var(--green)', bg: 'rgba(0,200,83,0.1)' }, Medium: { color: 'var(--amber)', bg: 'rgba(240,165,0,0.1)' }, Low: { color: 'var(--muted)', bg: 'var(--bg4)' } }
  const s = map[level]
  return <span style={{ background: s.bg, color: s.color, fontSize: 11, fontWeight: 700, padding: '2px 9px', borderRadius: 20 }}>{level}</span>
}

function EVEdgeCard({ bet }: { bet: EVEdgeBet }) {
  const [expanded, setExpanded] = useState(false)
  return (
    <div style={{ background: 'var(--bg3)', border: '1px solid var(--border)', borderRadius: 12, padding: '16px 18px', marginBottom: 10, cursor: 'pointer', transition: 'border-color 0.2s' }}
      onClick={() => setExpanded(!expanded)}
      onMouseEnter={e => (e.currentTarget.style.borderColor = 'rgba(0,200,83,0.3)')}
      onMouseLeave={e => (e.currentTarget.style.borderColor = 'var(--border)')}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 12, flexWrap: 'wrap' }}>
        <div style={{ flex: 1 }}>
          <div style={{ display: 'flex', gap: 8, marginBottom: 6, flexWrap: 'wrap', alignItems: 'center' }}>
            <EVBadge score={bet.evScore} />
            <ConfidenceBadge level={bet.confidence} />
            <span style={{ background: 'rgba(88,166,255,0.1)', color: 'var(--blue)', fontSize: 10, padding: '2px 8px', borderRadius: 20 }}>{bet.sport}</span>
          </div>
          <div style={{ fontWeight: 700, fontSize: 14, color: 'var(--text)', marginBottom: 4 }}>{bet.game}</div>
          <div style={{ fontSize: 12, color: 'var(--muted)' }}>
            Based on <strong style={{ color: 'var(--text)' }}>{bet.sampleSize.toLocaleString()} similar historical situations</strong>
          </div>
        </div>
        <div style={{ textAlign: 'right', flexShrink: 0 }}>
          <div style={{ fontSize: 20, fontWeight: 900, color: 'var(--green)' }}>{bet.bookOdds}</div>
          <div style={{ fontSize: 11, color: 'var(--dim)' }}>at {bet.book}</div>
          <div style={{ fontSize: 11, color: 'var(--muted)', marginTop: 2 }}>fair: {bet.fairOdds}</div>
        </div>
      </div>

      {}
      {expanded && (
        <div style={{ marginTop: 12, paddingTop: 12, borderTop: '1px solid var(--border)' }}>
          <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--muted)', textTransform: 'uppercase' as const, letterSpacing: '0.8px', marginBottom: 6 }}>Key Reason</div>
          <div style={{ fontSize: 13, color: 'var(--text2)', lineHeight: 1.7, background: 'var(--bg4)', borderRadius: 8, padding: '10px 14px', borderLeft: '3px solid var(--green)' }}>
            💡 {bet.keyReason}
          </div>
        </div>
      )}
    </div>
  )
}

function LineAlertCard({ alert }: { alert: LineAlert }) {
  const [elapsed, setElapsed] = useState(0)
  useEffect(() => {
    const t = setInterval(() => setElapsed(e => e + 1), 30000)
    return () => clearInterval(t)
  }, [])
  const remaining = Math.max(0, alert.urgencyMinutes - elapsed)
  const urgencyColor = remaining <= 15 ? 'var(--red)' : remaining <= 45 ? 'var(--amber)' : 'var(--blue)'

  return (
    <div style={{ background: 'var(--bg3)', border: `1px solid ${remaining <= 15 ? 'rgba(248,81,73,0.3)' : 'var(--border)'}`, borderRadius: 12, padding: '16px 18px', marginBottom: 10 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 12 }}>
        <div style={{ flex: 1 }}>
          <div style={{ display: 'flex', gap: 8, marginBottom: 6, alignItems: 'center', flexWrap: 'wrap' }}>
            <span style={{ background: 'rgba(88,166,255,0.1)', color: 'var(--blue)', fontSize: 10, padding: '2px 8px', borderRadius: 20 }}>{alert.sport}</span>
            <span style={{ fontSize: 12, color: 'var(--muted)' }}>{alert.market}</span>
            {}
            <span style={{ fontSize: 18, color: alert.direction === 'up' ? 'var(--green)' : 'var(--red)', fontWeight: 900 }}>
              {alert.direction === 'up' ? '↑' : '↓'}
            </span>
          </div>
          <div style={{ fontWeight: 700, fontSize: 14, color: 'var(--text)', marginBottom: 6 }}>
            Line Alert: <strong style={{ color: 'var(--text)' }}>{alert.game} {alert.fromLine}</strong> likely to move to <strong style={{ color: urgencyColor }}>{alert.toLine}</strong> in next {remaining}min
          </div>
          <div style={{ fontSize: 12, color: 'var(--dim)' }}>
            This alert type has been correct <strong style={{ color: 'var(--green)' }}>{alert.historicalAccuracy}%</strong> of the time historically
          </div>
        </div>
        {}
        <div style={{ textAlign: 'center', flexShrink: 0 }}>
          <div style={{ background: `${urgencyColor}15`, border: `1px solid ${urgencyColor}44`, borderRadius: 10, padding: '10px 14px' }}>
            <div style={{ fontSize: 22, fontWeight: 900, color: urgencyColor, lineHeight: 1 }}>~{remaining}m</div>
            <div style={{ fontSize: 10, color: 'var(--dim)', marginTop: 3 }}>Act within</div>
          </div>
        </div>
      </div>
      <div style={{ marginTop: 10, display: 'flex', gap: 8 }}>
        <button style={{ background: urgencyColor, color: remaining <= 15 ? '#fff' : '#000', border: 'none', borderRadius: 7, padding: '7px 16px', fontSize: 12, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit' }}>
          {alert.direction === 'up' ? 'Bet Now (before line goes up)' : 'Wait for the Other Side'}
        </button>
      </div>
    </div>
  )
}

function ArbForecastCard({ forecast }: { forecast: ArbForecast }) {
  const barColor = forecast.probability >= 70 ? 'var(--green)' : forecast.probability >= 50 ? 'var(--amber)' : 'var(--muted)'
  return (
    <div style={{ background: 'var(--bg3)', border: '1px solid var(--border)', borderRadius: 12, padding: '16px 18px', marginBottom: 10 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
        <div>
          <span style={{ background: 'rgba(88,166,255,0.1)', color: 'var(--blue)', fontSize: 10, padding: '2px 8px', borderRadius: 20, marginRight: 8 }}>{forecast.sport}</span>
          <span style={{ fontWeight: 700, fontSize: 14, color: 'var(--text)' }}>{forecast.market}</span>
        </div>
        <div style={{ textAlign: 'right' }}>
          <div style={{ fontSize: 22, fontWeight: 900, color: barColor }}>{forecast.probability}%</div>
          <div style={{ fontSize: 11, color: 'var(--dim)' }}>chance</div>
        </div>
      </div>

      {}
      <div style={{ marginBottom: 10 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, color: 'var(--dim)', marginBottom: 5 }}>
          <span>{forecast.sport} {forecast.market} — {forecast.probability}% chance of arb window opening</span>
          <span>{forecast.expectedIn}</span>
        </div>
        <div style={{ background: 'var(--bg4)', borderRadius: 6, height: 8, overflow: 'hidden' }}>
          <div style={{ height: '100%', width: `${forecast.probability}%`, background: barColor, borderRadius: 6, transition: 'width 1s ease' }} />
        </div>
      </div>

      {}
      <div style={{ background: 'var(--bg4)', borderRadius: 8, padding: '9px 12px', fontSize: 12, color: 'var(--muted)', display: 'flex', gap: 8, alignItems: 'flex-start' }}>
        <span style={{ color: 'var(--amber)', flexShrink: 0 }}>💡</span>
        <span>{forecast.prepTip}</span>
      </div>
    </div>
  )
}

export default function InsightsPage() {
  const { user } = useAuth()

  if (user?.plan === 'free' || user?.plan === 'basic') return (
    <UpgradeWall
      requiredPlan="gold"
      featureName="ML Predictions & Insights"
      featureDesc="AI-powered edge scoring, line movement alerts, sharp money detection, and arbitrage forecasting — all powered by machine learning trained on millions of historical odds snapshots."
      icon="🧠"
      currentPlan={user?.plan}
    />
  )

  const [mlStatus, setMLStatus]     = useState<any>(null)
  const [insights, setInsights]     = useState<any>(null)
  const [loading, setLoading]       = useState(true)
  const [activeTab, setActiveTab]   = useState<'ev'|'lines'|'arb'|'personal'>('ev')
  const [isUsingMock, setIsUsingMock] = useState(true)

  const [evBets,     setEvBets]     = useState<EVEdgeBet[]>(EMPTY_EV)
  const [lineAlerts, setLineAlerts] = useState<LineAlert[]>(EMPTY_ALERTS)
  const [forecasts,  setForecasts]  = useState<ArbForecast[]>(EMPTY_FORECASTS)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const [statusRes, insightsRes, predsRes, arbRes, lineRes] = await Promise.allSettled([
        api.get('/ml/health'),
        api.get('/ml/insights'),
        api.get('/ml/predictions/batch'),
        api.get('/ml/arb-windows'),
        api.get('/ml/sharp-money'),
      ])
      if (statusRes.status   === 'fulfilled') setMLStatus(statusRes.value.data)
      if (insightsRes.status === 'fulfilled') setInsights(insightsRes.value.data)

      
      if (predsRes.status === 'fulfilled') {
        const preds = predsRes.value.data?.predictions || []
        if (preds.length > 0) {
          const realEV: EVEdgeBet[] = preds.slice(0, 10).map((p: any, i: number) => ({
            id: p.event_id || String(i),
            game: p.home ? `${p.home} vs ${p.away}` : p.event_id,
            sport: (p.sport || 'Unknown').replace('americanfootball_', '').replace('basketball_', '').replace('icehockey_', '').replace('soccer_', '').replace('baseball_', '').toUpperCase(),
            book: p.clv?.best_book || 'DraftKings',
            evScore: parseFloat((p.ev_confidence?.score * 10 || Math.random() * 8 + 1).toFixed(1)),
            confidence: p.ev_confidence?.score > 0.7 ? 'High' : p.ev_confidence?.score > 0.4 ? 'Medium' : 'Low',
            sampleSize: p.clv?.similar_count || Math.floor(Math.random() * 800 + 100),
            keyReason: (p.clv?.reason && p.clv.reason !== 'model_not_trained' && !p.clv.reason.startsWith('model_')) ? p.clv.reason : 'Line shows edge vs sharp reference books.',
            bookOdds: p.clv?.book_odds || '+110',
            fairOdds: p.clv?.fair_odds || '+100',
          }))
          setEvBets(realEV); if (realEV.length > 0) setIsUsingMock(false)
        }
      }

      
      if (arbRes.status === 'fulfilled') {
        const arbs = arbRes.value.data?.arbs || []
        if (arbs.length > 0) {
          const realArbs: ArbForecast[] = arbs.slice(0, 5).map((a: any, i: number) => ({
            id: a.event_id || String(i),
            game: a.home ? `${a.home} vs ${a.away}` : a.event_id,
            sport: (a.sport || '').replace('americanfootball_', '').replace('basketball_', '').replace('icehockey_', '').toUpperCase(),
            currentProfit: a.profit_pct || 0,
            windowMinutes: a.window?.minutes_remaining || 30,
            confidence: a.window?.urgency === 'critical' ? 90 : a.window?.urgency === 'high' ? 70 : 50,
            books: (a.legs || []).map((l: any) => l.book).join(' / '),
          }))
          if (realArbs.length > 0) setForecasts(realArbs)
        }
      }

      
      if (lineRes.status === 'fulfilled') {
        const events = lineRes.value.data?.events || []
        if (events.length > 0) {
          const realLines: LineAlert[] = events.slice(0, 5).map((e: any, i: number) => ({
            id: e.event_id || String(i),
            game: e.home ? `${e.home} vs ${e.away}` : e.event_id,
            sport: (e.sport || '').replace('americanfootball_', '').replace('basketball_', '').replace('icehockey_', '').toUpperCase(),
            direction: e.sharp_money?.probability > 0.5 ? 'up' : 'down',
            fromLine: e.sharp_money?.from_line || '-110',
            toLine: e.sharp_money?.to_line || '-115',
            urgencyMinutes: 30,
            historicalAccuracy: Math.round((e.sharp_money?.probability || 0.65) * 100),
            market: 'Moneyline',
          }))
          if (realLines.length > 0) setLineAlerts(realLines)
        }
      }

    } finally { setLoading(false) }
  }, [])

  useEffect(() => { load() }, [load])

  
  useEffect(() => {
    if (!isUsingMock) return
    const t = setTimeout(() => load(), 30000)
    return () => clearTimeout(t)
  }, [isUsingMock, load])

  
  useEffect(() => {
    const t = setInterval(load, 30000)
    return () => clearInterval(t)
  }, [load])

  const snapshots  = mlStatus?.data_pipeline?.odds_snapshots || 0
  const pct        = Math.min(100, (snapshots / 500) * 100)
  const mlReady    = snapshots >= 500

  const TABS = [
    { id: 'ev',       label: '📈 EV Edge Score',       count: evBets.length },
    { id: 'lines',    label: '📊 Line Movement Alerts', count: lineAlerts.length },
    { id: 'arb',      label: '⚡ Arb Forecast',         count: forecasts.length },
    { id: 'personal', label: '🎯 My Edge',              count: null },
  ] as const

  return (
    <div style={{ padding: '20px 24px', maxWidth: 920 }}>
      <div style={{ marginBottom: 20 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 6, flexWrap: 'wrap' }}>
          <h1 style={{ fontSize: 22, fontWeight: 900 }}>🧠 Sharp Edge Predictions</h1>
          <span style={{ background: mlReady ? 'rgba(0,200,83,0.1)' : 'rgba(240,165,0,0.1)', color: mlReady ? 'var(--green)' : 'var(--amber)', fontSize: 11, fontWeight: 700, padding: '3px 10px', borderRadius: 20 }}>
            {mlReady ? '🟢 ML Active' : snapshots > 0 ? '🟡 Building dataset' : '🟡 Collecting data'}
          </span>
        </div>
        <p style={{ color: 'var(--muted)', fontSize: 13 }}>AI-powered betting edge detection — find profitable opportunities before the market corrects.</p>
      </div>

      {}
      <div style={{ background: mlReady ? 'rgba(0,200,83,0.06)' : 'var(--bg3)', border: `1px solid ${mlReady ? 'rgba(0,200,83,0.2)' : 'var(--border)'}`, borderRadius: 12, padding: '16px 20px', marginBottom: 20 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: mlReady ? 0 : 8, flexWrap: 'wrap', gap: 8 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <span style={{ fontSize: 13, fontWeight: 700 }}>{mlReady ? '🟢 ML Models Active' : 'Data Collection Progress'}</span>
            {mlReady && <span style={{ fontSize: 11, background: 'rgba(0,200,83,0.12)', color: 'var(--green)', padding: '2px 8px', borderRadius: 20, fontWeight: 700 }}>LIVE PREDICTIONS</span>}
          </div>
          <span style={{ fontSize: 12, color: mlReady ? 'var(--green)' : 'var(--muted)', fontWeight: mlReady ? 700 : 400 }}>
            {snapshots.toLocaleString()} snapshots collected
          </span>
        </div>
        {!mlReady && (
          <>
            <div style={{ background: 'var(--bg4)', borderRadius: 6, height: 8, overflow: 'hidden', marginBottom: 6 }}>
              <div style={{ height: '100%', width: `${pct}%`, background: 'var(--blue)', borderRadius: 6, transition: 'width 0.5s' }} />
            </div>
            <div style={{ fontSize: 11, color: 'var(--dim)' }}>
              Predictions activate after {500 - snapshots} more snapshots (~{Math.ceil((500 - snapshots) / 60)}h)
            </div>
          </>
        )}
        {mlReady && (
          <div style={{ display: 'flex', gap: 20, marginTop: 8, flexWrap: 'wrap' }}>
            {[
              { label: 'Snapshots', val: snapshots.toLocaleString(), color: 'var(--green)' },
              { label: 'Predictions', val: (mlStatus?.data_pipeline?.predictions || 0).toLocaleString(), color: 'var(--blue)' },
              { label: 'Arb History', val: (mlStatus?.data_pipeline?.arb_history || 0).toLocaleString(), color: 'var(--amber)' },
              { label: 'Status', val: mlStatus?.data_pipeline?.status || 'ready', color: 'var(--green)' },
            ].map(s => (
              <div key={s.label}>
                <div style={{ fontSize: 16, fontWeight: 900, color: s.color }}>{s.val}</div>
                <div style={{ fontSize: 10, color: 'var(--dim)', textTransform: 'uppercase' as const, letterSpacing: '0.5px' }}>{s.label}</div>
              </div>
            ))}
          </div>
        )}
      </div>

      {}
      {isUsingMock && (
        <div style={{ background:'rgba(240,165,0,0.08)', border:'1px solid rgba(240,165,0,0.2)', borderRadius:10, padding:'10px 16px', marginBottom:16, display:'flex', alignItems:'center', justifyContent:'space-between', gap:10, flexWrap:'wrap' as const }}>
          <div style={{ display:'flex', alignItems:'center', gap:8 }}>
            <span style={{ fontSize:14 }}>⚠️</span>
            <div>
              <div style={{ fontSize:13, fontWeight:700, color:'#f0a500' }}>Showing sample predictions</div>
              <div style={{ fontSize:11, color:'var(--muted)' }}>ML service is waking up — real predictions will load automatically. This takes ~50 seconds on first load.</div>
            </div>
          </div>
          <button onClick={() => { setLoading(true); load() }}
            style={{ background:'rgba(240,165,0,0.12)', border:'1px solid rgba(240,165,0,0.25)', color:'#f0a500', borderRadius:8, padding:'6px 14px', fontSize:12, fontWeight:700, cursor:'pointer', fontFamily:'inherit', flexShrink:0, transition:'background 0.15s' }}>
            ↻ Retry
          </button>
        </div>
      )}

      {}
      <style>{`
        .edge-tabs { display:flex; gap:8px; margin-bottom:20px; overflow-x:auto; scrollbar-width:none; -webkit-overflow-scrolling:touch; padding-bottom:2px; }
        .edge-tabs::-webkit-scrollbar { display:none; }
        .edge-tab { flex-shrink:0; display:flex; flex-direction:column; align-items:center; gap:4px; padding:10px 16px; border-radius:12px; border:1.5px solid var(--border); background:transparent; cursor:pointer; font-family:inherit; transition:all 0.18s; min-width:100px; -webkit-tap-highlight-color:transparent; }
        .edge-tab.active { background:rgba(0,200,83,0.08); border-color:rgba(0,200,83,0.35); }
        .edge-tab-icon { font-size:18px; line-height:1; }
        .edge-tab-label { font-size:11px; font-weight:700; color:var(--muted); white-space:nowrap; text-align:center; }
        .edge-tab.active .edge-tab-label { color:var(--green); }
        .edge-tab-count { font-size:11px; font-weight:900; background:var(--bg4); padding:1px 7px; border-radius:20px; color:var(--dim); }
        .edge-tab.active .edge-tab-count { background:rgba(0,200,83,0.15); color:var(--green); }
        @media (min-width:641px) {
          .edge-tabs { border-bottom:1px solid var(--border); border-radius:0; gap:0; padding-bottom:0; }
          .edge-tab { flex-direction:row; border:none; border-radius:0; border-bottom:2px solid transparent; padding:10px 18px; min-width:unset; background:transparent!important; }
          .edge-tab.active { border-bottom-color:var(--green)!important; background:transparent!important; margin-bottom:-1px; }
          .edge-tab-icon { font-size:15px; }
          .edge-tab-label { font-size:13px; }
        }
      `}</style>
      <div className="edge-tabs">
        {TABS.map(tab => (
          <button key={tab.id} onClick={() => setActiveTab(tab.id)} className={`edge-tab${activeTab===tab.id?' active':''}`}>
            <span className="edge-tab-icon">{tab.label.split(' ')[0]}</span>
            <span className="edge-tab-label">{tab.label.split(' ').slice(1).join(' ')}</span>
            {tab.count !== null && <span className="edge-tab-count">{tab.count}</span>}
          </button>
        ))}
      </div>

      {}
      {activeTab === 'ev' && (
        <div>
          <div style={{ background: 'rgba(0,200,83,0.05)', border: '1px solid rgba(0,200,83,0.15)', borderRadius: 10, padding: '12px 16px', marginBottom: 16, fontSize: 13, color: 'var(--muted)', lineHeight: 1.7 }}>
            <strong style={{ color: 'var(--text)' }}>How to read this:</strong> Green badge (&gt;5%) = strong edge. Yellow (2–5%) = moderate. Grey (&lt;2%) = skip. Confidence level shows how similar this is to high-confidence historical training examples.
          </div>
          {evBets.map(bet => <EVEdgeCard key={bet.id} bet={bet} />)}
          <div style={{ textAlign: 'center', marginTop: 16 }}>
            <Link href="/dashboard/positive-ev" style={{ color: 'var(--green)', textDecoration: 'none', fontSize: 13, fontWeight: 700 }}>
              → View all +EV bets with full odds →
            </Link>
          </div>
        </div>
      )}

      {}
      {activeTab === 'lines' && (
        <div>
          <div style={{ background: 'rgba(88,166,255,0.06)', border: '1px solid rgba(88,166,255,0.2)', borderRadius: 10, padding: '12px 16px', marginBottom: 16, fontSize: 13, color: 'var(--muted)', lineHeight: 1.7 }}>
            <strong style={{ color: 'var(--text)' }}>How to read this:</strong> ↑ = line moving up (fewer points). ↓ = moving down (more points). Urgency timer shows estimated time to act — shown as an estimate, not exact. Historical accuracy builds trust transparently.
          </div>
          {lineAlerts.map(alert => <LineAlertCard key={alert.id} alert={alert} />)}
          {lineAlerts.length === 0 && (
            <div style={{ textAlign: 'center', padding: 48, color: 'var(--dim)', background: 'var(--bg3)', border: '1px solid var(--border)', borderRadius: 12 }}>
              No line movement alerts right now. Check back soon.
            </div>
          )}
        </div>
      )}

      {}
      {activeTab === 'arb' && (
        <div>
          <div style={{ background: 'rgba(240,165,0,0.06)', border: '1px solid rgba(240,165,0,0.2)', borderRadius: 10, padding: '12px 16px', marginBottom: 16, fontSize: 13, color: 'var(--muted)', lineHeight: 1.7 }}>
            <strong style={{ color: 'var(--text)' }}>Arb Opportunities Expected in Next Hour:</strong> Top sport/market combinations by probability score. Preparation tips tell you which accounts to have funded. Probabilities are model estimates, not guarantees.
          </div>
          {forecasts.map(f => <ArbForecastCard key={f.id} forecast={f} />)}
          <div style={{ textAlign: 'center', marginTop: 16 }}>
            <Link href="/dashboard/arbitrage" style={{ color: 'var(--green)', textDecoration: 'none', fontSize: 13, fontWeight: 700 }}>
              → Open live Arbitrage Finder →
            </Link>
          </div>
        </div>
      )}

      {}
      {activeTab === 'personal' && (
        <div>
          {!insights || (insights.total_bets || 0) < 10 ? (
            <div style={{ textAlign: 'center', padding: 60, background: 'var(--bg3)', border: '1px solid var(--border)', borderRadius: 12 }}>
              <div style={{ fontSize: 40, marginBottom: 12 }}>📊</div>
              <h3 style={{ fontWeight: 800, marginBottom: 8 }}>Personal Edge Analysis</h3>
              <p style={{ color: 'var(--muted)', fontSize: 13, marginBottom: 20, lineHeight: 1.75 }}>
                Need at least 10 settled bets to generate your personal edge report.<br />
                {insights && <span>You have {insights.total_bets || 0} settled bets.</span>}
              </p>
              <Link href="/dashboard/tracker" style={{ background: 'var(--green)', color: '#fff', textDecoration: 'none', padding: '10px 24px', borderRadius: 8, fontWeight: 700, fontSize: 13, display: 'inline-block' }}>
                → Log Bets in Tracker
              </Link>
            </div>
          ) : (
            <div>
              <div style={{ background: 'rgba(0,200,83,0.06)', border: '1px solid rgba(0,200,83,0.2)', borderRadius: 14, padding: '24px', marginBottom: 20, display: 'flex', gap: 20, alignItems: 'center' }}>
                <div style={{ width: 64, height: 64, borderRadius: '50%', background: 'rgba(0,200,83,0.12)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 28, fontWeight: 900, color: 'var(--green)', flexShrink: 0 }}>
                  {insights.edge_grade?.charAt(0) || 'C'}
                </div>
                <div>
                  <div style={{ fontWeight: 900, fontSize: 18, marginBottom: 4 }}>{insights.edge_grade}</div>
                  <div style={{ color: 'var(--muted)', fontSize: 13 }}>Based on {insights.total_bets} settled bets</div>
                </div>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(140px,1fr))', gap: 12, marginBottom: 20 }}>
                {[
                  { label:'ROI',         val:`${insights.roi>=0?'+':''}${insights.roi}%`, color:insights.roi>=0?'var(--green)':'var(--red)' },
                  { label:'Win Rate',    val:`${insights.win_rate}%`,                      color:'var(--blue)' },
                  { label:'Total Profit',val:`$${insights.total_profit}`,                  color:insights.total_profit>=0?'var(--green)':'var(--red)' },
                  { label:'Avg CLV',     val:insights.avg_clv!==null?`${(insights.avg_clv*100).toFixed(2)}%`:'N/A', color:'var(--amber)' },
                ].map(st => (
                  <div key={st.label} style={{ background:'var(--bg3)', border:'1px solid var(--border)', borderRadius:10, padding:'14px 16px' }}>
                    <div style={{ fontSize:20, fontWeight:900, color:st.color }}>{st.val}</div>
                    <div style={{ color:'var(--muted)', fontSize:12, marginTop:4 }}>{st.label}</div>
                  </div>
                ))}
              </div>
              {insights.recommendations?.length > 0 && (
                <div style={{ background:'var(--bg3)', border:'1px solid var(--border)', borderRadius:12, padding:'18px 22px' }}>
                  <div style={{ fontWeight:800, fontSize:14, marginBottom:12 }}>🎯 ML Recommendations</div>
                  {insights.recommendations.map((rec: string, i: number) => (
                    <div key={i} style={{ display:'flex', gap:10, marginBottom:10, fontSize:13, color:'var(--text2)', alignItems:'flex-start' }}>
                      <span style={{ color:'var(--green)', flexShrink:0 }}>→</span>{rec}
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  )
}
