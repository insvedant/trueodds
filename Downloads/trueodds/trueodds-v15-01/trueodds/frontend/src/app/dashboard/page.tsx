'use client'
import { useState, useEffect } from 'react'
import Link from 'next/link'
import { useAuth, api } from '@/lib/auth'

const S = {
  page:     { padding: '20px 24px', maxWidth: 1100 } as React.CSSProperties,
  card:     { background: 'var(--bg3)', border: '1px solid var(--border)', borderRadius: 10 } as React.CSSProperties,
  statCard: { background: 'var(--bg3)', border: '1px solid var(--border)', borderRadius: 10, padding: '16px 18px' } as React.CSSProperties,
}

type Overview = {
  totalBets: number; settledBets: number; wins: number; losses: number
  pending: number; totalStake: number; totalProfit: number; roi: number; winRate: number
}

function Spinner({ color = 'var(--green)' }: { color?: string }) {
  return <div style={{ width: 28, height: 28, border: `3px solid var(--border)`, borderTopColor: color, borderRadius: '50%', animation: 'spin 0.8s linear infinite' }} />
}

export default function DashboardHome() {
  const { user } = useAuth()
  const [overview, setOverview]   = useState<Overview | null>(null)
  const [arbs, setArbs]           = useState<any[]>([])
  const [evBets, setEvBets]       = useState<any[]>([])
  const [alerts, setAlerts]       = useState<any[]>([])
  const [daily, setDaily]         = useState<any[]>([])
  const [loading, setLoading]     = useState(true)
  const [period, setPeriod]       = useState('30d')

  useEffect(() => {
    const load = async () => {
      setLoading(true)
      try {
        const [overviewRes, arbRes, evRes, alertRes] = await Promise.allSettled([
          api.get(`/analytics/overview?period=${period}`),
          api.get('/arbitrage?minProfit=0'),
          api.get('/ev?minEV=0'),
          api.get('/alerts'),
        ])
        if (overviewRes.status === 'fulfilled') {
          setOverview(overviewRes.value.data.overview)
          setDaily(overviewRes.value.data.daily || [])
        }
        if (arbRes.status === 'fulfilled') setArbs(arbRes.value.data.data?.slice(0, 3) || [])
        if (evRes.status  === 'fulfilled') setEvBets(evRes.value.data.data?.slice(0, 4) || [])
        if (alertRes.status === 'fulfilled') setAlerts(alertRes.value.data.alerts?.filter((a: any) => !a.read).slice(0, 3) || [])
      } finally { setLoading(false) }
    }
    load()
  }, [period])

  // P&L bar chart from real daily data
  const maxAbs = Math.max(...daily.map(d => Math.abs(d.profit)), 1)

  const stats = overview ? [
    { label: 'Total P&L',   val: `${overview.totalProfit >= 0 ? '+' : ''}$${overview.totalProfit.toFixed(0)}`,  color: overview.totalProfit >= 0 ? 'var(--green)' : 'var(--red)' },
    { label: 'ROI',          val: `${overview.roi >= 0 ? '+' : ''}${overview.roi}%`,                             color: overview.roi >= 0 ? 'var(--green)' : 'var(--red)' },
    { label: 'Win Rate',     val: `${overview.winRate}%`,                                                         color: 'var(--blue)' },
    { label: 'Live Arbs',   val: arbs.length,                                                                     color: 'var(--amber)' },
  ] : []

  return (
    <div style={S.page}>
      <style>{`@keyframes spin { to { transform:rotate(360deg) } }`}</style>

      {/* Header */}
      <div style={{ marginBottom: 20, display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 10 }}>
        <div>
          <h1 style={{ fontSize: 22, fontWeight: 900, marginBottom: 4 }}>Welcome back, {user?.name?.split(' ')[0]} 👋</h1>
          <p style={{ color: 'var(--muted)', fontSize: 13 }}>Here's your betting overview for today</p>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          {['7d','30d','90d'].map(p => (
            <button key={p} onClick={() => setPeriod(p)} style={{ padding: '5px 12px', borderRadius: 20, fontSize: 12, border: 'none', cursor: 'pointer', fontFamily: 'inherit', background: period === p ? 'var(--green)' : 'var(--bg3)', color: period === p ? '#000' : 'var(--muted)', fontWeight: period === p ? 700 : 400 }}>{p}</button>
          ))}
          <span style={{ background: 'rgba(137,87,229,0.12)', color: 'var(--purple)', fontSize: 11, fontWeight: 700, padding: '4px 12px', borderRadius: 20, textTransform: 'uppercase' as const }}>{user?.plan} plan</span>
        </div>
      </div>

      {/* Urgent alerts */}
      {alerts.length > 0 && (
        <div style={{ background: 'rgba(0,200,83,0.06)', border: '1px solid rgba(0,200,83,0.3)', borderRadius: 10, padding: '12px 16px', marginBottom: 18 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
            <span style={{ fontSize: 13, fontWeight: 700, display: 'flex', alignItems: 'center', gap: 6 }}>
              <span style={{ width: 7, height: 7, background: 'var(--green)', borderRadius: '50%', display: 'inline-block', animation: 'spin 2s linear infinite' }} />
              {alerts.length} urgent alerts right now
            </span>
            <Link href="/dashboard/alerts" style={{ fontSize: 12, color: 'var(--blue)', textDecoration: 'none' }}>View all →</Link>
          </div>
          {alerts.map((a: any, i: number) => (
            <div key={i} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '6px 0', borderTop: i > 0 ? '1px solid var(--border)' : 'none' }}>
              <span style={{ fontSize: 13, color: 'var(--text2)' }}>{a.title || a.message}</span>
              {a.value && <span style={{ background: 'rgba(0,200,83,0.12)', color: 'var(--green)', fontSize: 11, fontWeight: 800, padding: '2px 8px', borderRadius: 20 }}>{a.value}</span>}
            </div>
          ))}
        </div>
      )}

      {/* Stats row */}
      {loading ? (
        <div style={{ display: 'flex', justifyContent: 'center', padding: 40 }}><Spinner /></div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(180px,1fr))', gap: 12, marginBottom: 20 }}>
          {stats.map(s => (
            <div key={s.label} style={S.statCard}>
              <div style={{ fontSize: 24, fontWeight: 900, color: s.color }}>{s.val}</div>
              <div style={{ color: 'var(--muted)', fontSize: 12, marginTop: 4 }}>{s.label}</div>
              <div style={{ fontSize: 11, color: 'var(--dim)', marginTop: 2 }}>
                {s.label === 'Win Rate' && overview ? `${overview.wins}W / ${overview.losses}L` :
                 s.label === 'Total P&L' ? `${overview?.settledBets} bets tracked` :
                 s.label === 'ROI' ? `on $${overview?.totalStake?.toFixed(0)} staked` :
                 s.label === 'Live Arbs' ? '3 hot right now' : ''}
              </div>
            </div>
          ))}
          {!overview && <div style={{ gridColumn: '1/-1', textAlign: 'center', color: 'var(--dim)', fontSize: 13, padding: 20 }}>No bets tracked yet — <Link href="/dashboard/tracker" style={{ color: 'var(--green)' }}>add your first bet</Link></div>}
        </div>
      )}

      {/* Main grid */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 18, marginBottom: 20 }}>

        {/* P&L Chart */}
        <div style={{ ...S.card, padding: 18 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 14, alignItems: 'center' }}>
            <span style={{ fontWeight: 700, fontSize: 14 }}>Profit Over Time</span>
            <span style={{ fontSize: 11, color: 'var(--dim)' }}>Last {period}</span>
          </div>
          {daily.length > 0 ? (
            <>
              <div style={{ display: 'flex', alignItems: 'flex-end', gap: 3, height: 80, marginBottom: 8 }}>
                {daily.map((d, i) => {
                  const h = Math.max(4, (Math.abs(d.profit) / maxAbs) * 72)
                  return (
                    <div key={i} title={`${d.date}: ${d.profit >= 0 ? '+' : ''}$${d.profit.toFixed(0)}`}
                      style={{ flex: 1, height: h, background: d.profit >= 0 ? 'var(--green)' : 'var(--red)', borderRadius: '2px 2px 0 0', opacity: 0.8, cursor: 'pointer', minWidth: 4 }} />
                  )
                })}
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, color: 'var(--dim)' }}>
                {daily.length > 0 && <span>{daily[0]?.date?.slice(5)}</span>}
                {daily.length > 0 && <span>{daily[daily.length-1]?.date?.slice(5)}</span>}
              </div>
              {overview && (
                <div style={{ display: 'flex', gap: 20, marginTop: 10, paddingTop: 10, borderTop: '1px solid var(--border)' }}>
                  <div><div style={{ fontWeight: 800, fontSize: 15, color: overview.totalProfit >= 0 ? 'var(--green)' : 'var(--red)' }}>{overview.totalProfit >= 0 ? '+' : ''}${overview.totalProfit.toFixed(0)}</div><div style={{ fontSize: 11, color: 'var(--dim)' }}>Total profit</div></div>
                  <div><div style={{ fontWeight: 800, fontSize: 15, color: 'var(--blue)' }}>${overview.totalStake?.toFixed(0)}</div><div style={{ fontSize: 11, color: 'var(--dim)' }}>Total staked</div></div>
                  <div><div style={{ fontWeight: 800, fontSize: 15 }}>{overview.roi}%</div><div style={{ fontSize: 11, color: 'var(--dim)' }}>ROI</div></div>
                </div>
              )}
            </>
          ) : (
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: 80, color: 'var(--dim)', fontSize: 13 }}>
              No bet history yet
            </div>
          )}
        </div>

        {/* Hot Arbs */}
        <div style={{ ...S.card, padding: 18 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 14 }}>
            <span style={{ fontWeight: 700, fontSize: 14 }}>🔥 Hot Arbs Now</span>
            <Link href="/dashboard/arbitrage" style={{ fontSize: 12, color: 'var(--blue)', textDecoration: 'none' }}>View all →</Link>
          </div>
          {loading ? <div style={{ display: 'flex', justifyContent: 'center', padding: 20 }}><Spinner /></div> :
           arbs.length === 0 ? (
            <div style={{ textAlign: 'center', padding: 24, color: 'var(--dim)', fontSize: 13 }}>No arbs right now — <Link href="/dashboard/arbitrage" style={{ color: 'var(--green)' }}>check finder</Link></div>
           ) : arbs.map((arb, i) => (
            <div key={i} style={{ padding: '10px 0', borderBottom: i < arbs.length - 1 ? '1px solid var(--border)' : 'none' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                <span style={{ fontWeight: 700, fontSize: 13, color: 'var(--text)' }}>{arb.game}</span>
                <span style={{ fontWeight: 900, fontSize: 16, color: 'var(--green)' }}>+{arb.profit}%</span>
              </div>
              <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                <span style={{ background: 'rgba(88,166,255,0.1)', color: 'var(--blue)', fontSize: 10, padding: '2px 7px', borderRadius: 20 }}>{arb.sport}</span>
                <span style={{ fontSize: 11, color: 'var(--dim)' }}>{arb.b1} vs {arb.b2}</span>
              </div>
            </div>
          ))}
          {arbs.length > 0 && (
            <Link href="/dashboard/arbitrage" style={{ display: 'block', textAlign: 'center', marginTop: 12, background: 'var(--green)', color: '#000', textDecoration: 'none', borderRadius: 8, padding: '9px', fontSize: 13, fontWeight: 800 }}>
              ⚡ Open Arbitrage Finder
            </Link>
          )}
        </div>
      </div>

      {/* Top +EV Bets */}
      <div style={{ ...S.card, padding: 18, marginBottom: 18 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 14 }}>
          <span style={{ fontWeight: 700, fontSize: 14 }}>📈 Top +EV Bets Right Now</span>
          <Link href="/dashboard/positive-ev" style={{ fontSize: 12, color: 'var(--blue)', textDecoration: 'none' }}>View all {evBets.length > 0 ? evBets.length : ''} →</Link>
        </div>
        {loading ? <div style={{ display: 'flex', justifyContent: 'center', padding: 20 }}><Spinner /></div> :
         user?.plan === 'free' ? (
          <div style={{ textAlign: 'center', padding: 24 }}>
            <span style={{ color: 'var(--dim)', fontSize: 13 }}>🔒 +EV bets require Gold or Platinum — </span>
            <Link href="/pricing" style={{ color: 'var(--green)', fontSize: 13, fontWeight: 700, textDecoration: 'none' }}>Upgrade →</Link>
          </div>
         ) : evBets.length === 0 ? (
          <div style={{ textAlign: 'center', padding: 24, color: 'var(--dim)', fontSize: 13 }}>No +EV bets found right now</div>
         ) : (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(240px,1fr))', gap: 12 }}>
            {evBets.map((bet, i) => (
              <div key={i} style={{ background: 'var(--bg4)', border: '1px solid var(--border)', borderRadius: 9, padding: '14px 16px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
                  <span style={{ fontWeight: 700, fontSize: 13, color: 'var(--text)' }}>{bet.game}</span>
                  <span style={{ fontWeight: 900, color: 'var(--green)', fontSize: 15 }}>+{bet.ev}%</span>
                </div>
                <div style={{ fontSize: 11, color: 'var(--muted)', marginBottom: 6 }}>{bet.sport} · {bet.market}</div>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11 }}>
                  <span style={{ color: 'var(--green)', fontWeight: 700 }}>{bet.bookOdds}</span>
                  <span style={{ color: 'var(--dim)' }}>fair: {bet.fairOdds}</span>
                  <span style={{ color: 'var(--amber)' }}>~{bet.prob}</span>
                </div>
              </div>
            ))}
          </div>
         )}
      </div>

      {/* Quick links */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(150px,1fr))', gap: 12 }}>
        {[
          { href:'/dashboard/arbitrage', icon:'⚡', title:'Arbitrage',  desc:`${arbs.length} live`, color:'var(--green)' },
          { href:'/dashboard/positive-ev',icon:'📈',title:'+EV Bets',  desc:'Live feed',           color:'var(--blue)' },
          { href:'/dashboard/odds',       icon:'📊', title:'Live Odds', desc:'100+ books',          color:'var(--purple)' },
          { href:'/dashboard/tracker',    icon:'📋', title:'Tracker',   desc:'Log your bets',       color:'var(--amber)' },
          { href:'/dashboard/calculators',icon:'🧮', title:'Calculators',desc:'Arb · EV · Kelly',  color:'var(--green)' },
          { href:'/dashboard/insights',   icon:'🧠', title:'ML',        desc:'Predictions',         color:'var(--blue)' },
          { href:'/dashboard/alerts',     icon:'🔔', title:'Alerts',    desc:`${alerts.length} new`,color:'var(--red)' },
        ].map(link => (
          <Link key={link.href} href={link.href} style={{ textDecoration:'none', background:'var(--bg3)', border:'1px solid var(--border)', borderRadius:10, padding:'14px', display:'block', transition:'border-color 0.2s' }}
            onMouseEnter={e => (e.currentTarget.style.borderColor = link.color)}
            onMouseLeave={e => (e.currentTarget.style.borderColor = 'var(--border)')}>
            <div style={{ fontSize:22, marginBottom:6 }}>{link.icon}</div>
            <div style={{ fontWeight:700, fontSize:13, color:'var(--text)' }}>{link.title}</div>
            <div style={{ fontSize:11, color:'var(--dim)', marginTop:2 }}>{link.desc}</div>
          </Link>
        ))}
      </div>
    </div>
  )
}
