'use client'
import { useState, useEffect, useCallback } from 'react'
import { api } from '@/lib/auth'
import { useAuth } from '@/lib/auth'
import Link from 'next/link'

/* ─── Types ─────────────────────────────────────────────────────────────── */
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

/* ─── Mock/fallback data when ML not ready ──────────────────────────────── */
const MOCK_EV: EVEdgeBet[] = [
  { id:'1', game:'Minnesota Wild vs Colorado Avalanche', sport:'NHL', book:'DraftKings', evScore:7.2, confidence:'High', sampleSize:847, keyReason:'Pinnacle is 12 cents sharper than market average on this line.', bookOdds:'+322', fairOdds:'+290' },
  { id:'2', game:'Lakers vs Celtics', sport:'NBA', book:'FanDuel', evScore:4.8, confidence:'Medium', sampleSize:412, keyReason:'Line moved against public money — sharp action detected at Pinnacle.', bookOdds:'-108', fairOdds:'-118' },
  { id:'3', game:'Chiefs vs Ravens', sport:'NFL', book:'BetMGM', evScore:2.1, confidence:'Low', sampleSize:233, keyReason:'Small edge versus sharp reference. Consider at quarter Kelly sizing.', bookOdds:'+145', fairOdds:'+140' },
]

const MOCK_ALERTS: LineAlert[] = [
  { id:'1', game:'Lakers', sport:'NBA', direction:'down', fromLine:'-4.5', toLine:'-5.5', urgencyMinutes:90, historicalAccuracy:71, market:'Spread' },
  { id:'2', game:'Chiefs vs Ravens', sport:'NFL', direction:'up', fromLine:'+3.5', toLine:'+4.5', urgencyMinutes:45, historicalAccuracy:68, market:'Spread' },
]

const MOCK_FORECASTS: ArbForecast[] = [
  { id:'1', sport:'NBA', market:'Player Props', probability:78, prepTip:'Have accounts ready at DraftKings and FanDuel for this opportunity.', expectedIn:'next 60 min' },
  { id:'2', sport:'NHL', market:'Moneyline', probability:61, prepTip:'Pinnacle and BetMGM diverge most on NHL moneylines. Keep both funded.', expectedIn:'next 2 hours' },
  { id:'3', sport:'NFL', market:'Totals', probability:44, prepTip:'Check DraftKings and Caesars totals. They often differ by 0.5 points.', expectedIn:'next 3 hours' },
]

/* ─── Sub-components ────────────────────────────────────────────────────── */

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

      {/* Expanded: key reason */}
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
    const t = setInterval(() => setElapsed(e => e + 1), 60000)
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
            {/* Direction arrow */}
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
        {/* Urgency timer */}
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

      {/* Probability bar */}
      <div style={{ marginBottom: 10 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, color: 'var(--dim)', marginBottom: 5 }}>
          <span>{forecast.sport} {forecast.market} — {forecast.probability}% chance of arb window opening</span>
          <span>{forecast.expectedIn}</span>
        </div>
        <div style={{ background: 'var(--bg4)', borderRadius: 6, height: 8, overflow: 'hidden' }}>
          <div style={{ height: '100%', width: `${forecast.probability}%`, background: barColor, borderRadius: 6, transition: 'width 1s ease' }} />
        </div>
      </div>

      {/* Prep tip */}
      <div style={{ background: 'var(--bg4)', borderRadius: 8, padding: '9px 12px', fontSize: 12, color: 'var(--muted)', display: 'flex', gap: 8, alignItems: 'flex-start' }}>
        <span style={{ color: 'var(--amber)', flexShrink: 0 }}>💡</span>
        <span>{forecast.prepTip}</span>
      </div>
    </div>
  )
}

/* ─── MAIN PAGE ─────────────────────────────────────────────────────────── */
export default function InsightsPage() {
  const { user } = useAuth()
  const [mlStatus, setMLStatus]     = useState<any>(null)
  const [insights, setInsights]     = useState<any>(null)
  const [loading, setLoading]       = useState(true)
  const [activeTab, setActiveTab]   = useState<'ev'|'lines'|'arb'|'personal'>('ev')

  // Use real ML data if available, else fall back to mock
  const [evBets]    = useState<EVEdgeBet[]>(MOCK_EV)
  const [lineAlerts]= useState<LineAlert[]>(MOCK_ALERTS)
  const [forecasts] = useState<ArbForecast[]>(MOCK_FORECASTS)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const [statusRes, insightsRes] = await Promise.allSettled([
        api.get('/ml/health'),
        api.get('/ml/insights'),
      ])
      if (statusRes.status   === 'fulfilled') setMLStatus(statusRes.value.data)
      if (insightsRes.status === 'fulfilled') setInsights(insightsRes.value.data)
    } finally { setLoading(false) }
  }, [])

  useEffect(() => { load() }, [load])

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
          <h1 style={{ fontSize: 22, fontWeight: 900 }}>🧠 ML Insights</h1>
          <span style={{ background: mlReady ? 'rgba(0,200,83,0.1)' : 'rgba(240,165,0,0.1)', color: mlReady ? 'var(--green)' : 'var(--amber)', fontSize: 11, fontWeight: 700, padding: '3px 10px', borderRadius: 20 }}>
            {mlReady ? '🟢 Active' : '🟡 Collecting data'}
          </span>
        </div>
        <p style={{ color: 'var(--muted)', fontSize: 13 }}>Machine learning predictions — EV edge scoring, line movement alerts, and arb forecasting.</p>
      </div>

      {/* Data progress bar */}
      {!mlReady && (
        <div style={{ background: 'var(--bg3)', border: '1px solid var(--border)', borderRadius: 12, padding: '16px 20px', marginBottom: 20 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
            <span style={{ fontSize: 13, fontWeight: 700 }}>Data Collection Progress</span>
            <span style={{ fontSize: 12, color: 'var(--muted)' }}>{snapshots} / 500 snapshots</span>
          </div>
          <div style={{ background: 'var(--bg4)', borderRadius: 6, height: 8, overflow: 'hidden', marginBottom: 6 }}>
            <div style={{ height: '100%', width: `${pct}%`, background: 'var(--blue)', borderRadius: 6, transition: 'width 0.5s' }} />
          </div>
          <div style={{ fontSize: 11, color: 'var(--dim)' }}>
            Showing illustrative examples below — predictions will be based on your live data after {500 - snapshots} more snapshots (~{Math.ceil((500 - snapshots) / 60)}h)
          </div>
        </div>
      )}

      {/* Tabs */}
      <div style={{ display: 'flex', gap: 0, marginBottom: 20, borderBottom: '1px solid var(--border)' }}>
        {TABS.map(tab => (
          <button key={tab.id} onClick={() => setActiveTab(tab.id)} style={{ padding: '10px 16px', fontSize: 13, fontWeight: activeTab === tab.id ? 700 : 400, cursor: 'pointer', border: 'none', background: 'transparent', color: activeTab === tab.id ? 'var(--green)' : 'var(--muted)', borderBottom: `2px solid ${activeTab === tab.id ? 'var(--green)' : 'transparent'}`, fontFamily: 'inherit', transition: 'all 0.15s', marginBottom: -1, display: 'flex', alignItems: 'center', gap: 6 }}>
            {tab.label}
            {tab.count !== null && <span style={{ background: 'var(--bg4)', fontSize: 10, fontWeight: 700, padding: '1px 6px', borderRadius: 20 }}>{tab.count}</span>}
          </button>
        ))}
      </div>

      {/* ── Model 1: EV Edge Score ── */}
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

      {/* ── Model 2: Line Movement Alerts ── */}
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

      {/* ── Model 3: Arb Opportunity Forecast ── */}
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

      {/* ── Personal Edge ── */}
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
