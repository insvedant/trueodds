'use client'
import { useState, useEffect, useRef } from 'react'
import { api } from '@/lib/auth'
import Link from 'next/link'
import { useRevenuePing } from '@/components/Celebrations'

export default function AdminOverviewPage() {
  const [stats, setStats]   = useState<any>(null)
  const [chart, setChart]   = useState<any[]>([])
  const [loading, setLoading] = useState(true)

  const { triggerRevenue, RevenueCelebrations } = useRevenuePing()
  const prevRevenue = useRef<number>(0)

  useEffect(() => {
    const load = async () => {
      try {
        const res = await api.get('/admin/overview')
        const newStats = res.data.stats
        // Trigger celebration if revenue increased
        if (prevRevenue.current > 0 && newStats.totalRevenue > prevRevenue.current) {
          const diff = newStats.totalRevenue - prevRevenue.current
          triggerRevenue(diff, newStats.latestPlan || 'gold')
        }
        prevRevenue.current = newStats.totalRevenue || 0
        setStats(newStats)
        const revenueRes = await api.get('/admin/revenue/monthly').catch(() => null)
        setChart(revenueRes?.data?.monthly || [])
      } catch (e) {
        console.error('Admin overview error:', e)
      } finally { setLoading(false) }
    }
    load()
    // Poll every 30 seconds for new subscriptions
    const t = setInterval(load, 30000)
    return () => clearInterval(t)
  }, [])

  const card: React.CSSProperties = { background: 'var(--bg3)', border: '1px solid var(--border)', borderRadius: 12, padding: '20px' }
  const maxRevenue = Math.max(...chart.map(m => m.revenue || 0), 1)

  if (loading) return (
    <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: 300 }}>
      <div style={{ width: 32, height: 32, border: '3px solid var(--border)', borderTopColor: 'var(--green)', borderRadius: '50%', animation: 'spin 0.8s linear infinite' }} />
      <style>{`@keyframes spin { to { transform:rotate(360deg) } }`}</style>
    </div>
  )

  return (
    <div style={{ padding: '24px', maxWidth: 1100 }}>
      <RevenueCelebrations />
      <style>{`@keyframes spin { to { transform:rotate(360deg) } }`}</style>
      <h1 style={{ fontSize: 22, fontWeight: 900, marginBottom: 6 }}>📊 Admin Overview</h1>
      <p style={{ color: 'var(--muted)', fontSize: 13, marginBottom: 24 }}>Real-time platform data from MongoDB</p>

      {/* KPI cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(180px,1fr))', gap: 14, marginBottom: 28 }}>
        {[
          { label: 'Total Users',      val: stats?.totalUsers ?? 0,                  color: 'var(--blue)' },
          { label: 'Active Subs',      val: stats?.activeUsers ?? 0,                  color: 'var(--green)' },
          { label: 'New This Month',   val: stats?.newThisMonth ?? 0,                 color: 'var(--amber)' },
          { label: 'Total Revenue',    val: `$${(stats?.totalRevenue || 0).toFixed(0)}`, color: 'var(--green)' },
          { label: 'This Month',       val: `$${(stats?.monthlyRevenue || 0).toFixed(0)}`, color: 'var(--green)' },
          { label: 'Last Month',       val: `$${(stats?.lastMonthRevenue || 0).toFixed(0)}`, color: 'var(--muted)' },
          { label: 'Total Bets',       val: stats?.totalBets ?? 0,                   color: 'var(--blue)' },
          { label: 'Total Staked',     val: `$${(stats?.totalStaked || 0).toFixed(0)}`, color: 'var(--muted)' },
        ].map(s => (
          <div key={s.label} style={card}>
            <div style={{ fontSize: 26, fontWeight: 900, color: s.color, marginBottom: 4 }}>{s.val}</div>
            <div style={{ color: 'var(--muted)', fontSize: 12 }}>{s.label}</div>
          </div>
        ))}
      </div>

      {/* Plan breakdown */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 18, marginBottom: 24 }}>
        <div style={card}>
          <div style={{ fontWeight: 800, fontSize: 15, marginBottom: 16 }}>Plan Distribution</div>
          {stats?.planCounts && Object.entries(stats.planCounts).map(([plan, count]) => {
            const total  = stats.totalUsers || 1
            const pct    = Math.round((count as number) / total * 100)
            const colors: Record<string, string> = { gold: 'var(--amber)', platinum: 'var(--purple)', free: 'var(--muted)' }
            return (
              <div key={plan} style={{ marginBottom: 14 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 5 }}>
                  <span style={{ fontSize: 13, fontWeight: 700, textTransform: 'capitalize' as const, color: colors[plan] }}>{plan}</span>
                  <span style={{ fontSize: 13, color: 'var(--muted)' }}>{count as number} users ({pct}%)</span>
                </div>
                <div style={{ background: 'var(--bg4)', borderRadius: 4, height: 7, overflow: 'hidden' }}>
                  <div style={{ height: '100%', width: `${pct}%`, background: colors[plan] || 'var(--muted)', borderRadius: 4 }} />
                </div>
              </div>
            )
          })}
          {!stats?.planCounts && <div style={{ color: 'var(--dim)', fontSize: 13 }}>No user data yet</div>}
        </div>

        <div style={card}>
          <div style={{ fontWeight: 800, fontSize: 15, marginBottom: 16 }}>Revenue Summary</div>
          {[
            { label: 'Total revenue',    val: `$${(stats?.totalRevenue || 0).toFixed(2)}`,    color: 'var(--green)' },
            { label: 'This month',       val: `$${(stats?.monthlyRevenue || 0).toFixed(2)}`,  color: 'var(--green)' },
            { label: 'Last month',       val: `$${(stats?.lastMonthRevenue || 0).toFixed(2)}`,color: 'var(--muted)' },
            { label: 'Paying users',     val: stats?.activeUsers ?? 0,                        color: 'var(--blue)' },
            { label: 'Total bet volume', val: `$${(stats?.totalStaked || 0).toFixed(0)}`,     color: 'var(--muted)' },
          ].map(r => (
            <div key={r.label} style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 0', borderBottom: '1px solid var(--border)' }}>
              <span style={{ fontSize: 13, color: 'var(--muted)' }}>{r.label}</span>
              <span style={{ fontSize: 14, fontWeight: 800, color: r.color }}>{r.val}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Revenue chart */}
      {chart.length > 0 && (
        <div style={{ ...card, marginBottom: 24 }}>
          <div style={{ fontWeight: 800, fontSize: 15, marginBottom: 16 }}>Monthly Revenue</div>
          <div style={{ display: 'flex', alignItems: 'flex-end', gap: 8, height: 100 }}>
            {chart.map((m, i) => {
              const h = Math.max(4, (m.revenue / maxRevenue) * 90)
              return (
                <div key={i} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4 }}>
                  <div style={{ width: '100%', height: h, background: 'var(--green)', borderRadius: '3px 3px 0 0', opacity: 0.8 }} title={`$${m.revenue}`} />
                  <div style={{ fontSize: 9, color: 'var(--dim)', transform: 'rotate(-45deg)', transformOrigin: 'top center', marginTop: 4 }}>{m.month}</div>
                </div>
              )
            })}
          </div>
        </div>
      )}

      {/* Quick links */}
      <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
        {[
          { href: '/admin/users',   icon: '👥', label: 'Manage Users' },
          { href: '/admin/revenue', icon: '💰', label: 'Revenue Details' },
          { href: '/admin/bets',    icon: '🎯', label: 'All Bets' },
          { href: '/admin/blog',    icon: '✍️', label: 'Blog Manager' },
          { href: '/admin/settings',icon: '⚙️', label: 'Settings' },
        ].map(l => (
          <Link key={l.href} href={l.href} style={{ textDecoration: 'none', background: 'var(--bg3)', border: '1px solid var(--border)', borderRadius: 10, padding: '12px 18px', display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, fontWeight: 600, color: 'var(--text)', transition: 'border-color 0.2s' }}
            onMouseEnter={e => (e.currentTarget.style.borderColor = 'var(--green)')}
            onMouseLeave={e => (e.currentTarget.style.borderColor = 'var(--border)')}>
            {l.icon} {l.label}
          </Link>
        ))}
      </div>
    </div>
  )
}
