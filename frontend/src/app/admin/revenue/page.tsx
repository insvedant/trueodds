'use client'
import { useState, useEffect } from 'react'
import { api } from '@/lib/auth'

export default function AdminRevenuePage() {
  const [payments, setPayments] = useState<any[]>([])
  const [monthly, setMonthly]   = useState<any[]>([])
  const [totals, setTotals]     = useState<any>({})
  const [loading, setLoading]   = useState(true)
  const [period, setPeriod]     = useState('all')

  useEffect(() => {
    const load = async () => {
      setLoading(true)
      try {
        const [overviewRes, paymentsRes] = await Promise.allSettled([
          api.get('/admin/overview'),
          api.get(`/admin/payments?period=${period}`),
        ])

        if (overviewRes.status === 'fulfilled') {
          const s = overviewRes.value.data.stats
          setTotals({
            totalRevenue:   s.totalRevenue   || 0,
            monthlyRevenue: s.monthlyRevenue || 0,
            lastMonthRevenue: s.lastMonthRevenue || 0,
            activeUsers:    s.activeUsers    || 0,
          })
        }

        if (paymentsRes.status === 'fulfilled') {
          setPayments(paymentsRes.value.data.payments || [])
          setMonthly(paymentsRes.value.data.monthly   || [])
        }
      } finally { setLoading(false) }
    }
    load()
  }, [period])

  const maxRevenue = Math.max(...monthly.map(m => m.revenue || 0), 1)
  const card: React.CSSProperties = { background: 'var(--bg3)', border: '1px solid var(--border)', borderRadius: 12, padding: '20px' }

  return (
    <div style={{ padding: 'clamp(14px,4vw,24px)', maxWidth: 1000 }}>
      <style>{`@keyframes spin { to { transform:rotate(360deg) } }`}</style>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 24, flexWrap: 'wrap', gap: 12 }}>
        <div>
          <h1 style={{ fontSize: 22, fontWeight: 900, marginBottom: 4 }}>💰 Revenue</h1>
          <p style={{ color: 'var(--muted)', fontSize: 13 }}>Real payment history from Stripe via MongoDB</p>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          {[['all','All Time'],['30d','Last 30d'],['7d','Last 7d']].map(([val, label]) => (
            <button key={val} onClick={() => setPeriod(val)} style={{ padding: '6px 14px', borderRadius: 20, fontSize: 12, border: 'none', cursor: 'pointer', fontFamily: 'inherit', background: period === val ? 'var(--green)' : 'var(--bg3)', color: period === val ? '#000' : 'var(--muted)', fontWeight: period === val ? 700 : 400 }}>{label}</button>
          ))}
        </div>
      </div>

      {}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(180px,1fr))', gap: 14, marginBottom: 24 }}>
        {[
          { label: 'Total Revenue',  val: `$${totals.totalRevenue?.toFixed(2) || '0.00'}`,   color: 'var(--green)' },
          { label: 'This Month',     val: `$${totals.monthlyRevenue?.toFixed(2) || '0.00'}`,  color: 'var(--green)' },
          { label: 'Last Month',     val: `$${totals.lastMonthRevenue?.toFixed(2) || '0.00'}`,color: 'var(--muted)' },
          { label: 'Paying Users',   val: totals.activeUsers || 0,                            color: 'var(--blue)' },
        ].map(s => (
          <div key={s.label} style={card}>
            <div style={{ fontSize: 26, fontWeight: 900, color: s.color, marginBottom: 4 }}>{s.val}</div>
            <div style={{ color: 'var(--muted)', fontSize: 12 }}>{s.label}</div>
          </div>
        ))}
      </div>

      {}
      {monthly.length > 0 && (
        <div style={{ ...card, marginBottom: 24 }}>
          <div style={{ fontWeight: 800, fontSize: 15, marginBottom: 16 }}>Monthly Revenue Breakdown</div>
          <div style={{ display: 'flex', alignItems: 'flex-end', gap: 10, height: 120, marginBottom: 8 }}>
            {monthly.map((m, i) => {
              const h = Math.max(4, (m.revenue / maxRevenue) * 110)
              return (
                <div key={i} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 3 }}>
                  <div style={{ fontSize: 10, color: 'var(--dim)' }}>${m.revenue?.toFixed(0)}</div>
                  <div style={{ width: '100%', height: h, background: 'var(--green)', borderRadius: '4px 4px 0 0', opacity: 0.85 }} />
                  <div style={{ fontSize: 10, color: 'var(--muted)' }}>{m.month}</div>
                </div>
              )
            })}
          </div>
        </div>
      )}

      {}
      <div style={card}>
        <div style={{ fontWeight: 800, fontSize: 15, marginBottom: 16 }}>Payment History</div>

        {loading ? (
          <div style={{ display: 'flex', justifyContent: 'center', padding: 40 }}>
            <div style={{ width: 28, height: 28, border: '3px solid var(--border)', borderTopColor: 'var(--green)', borderRadius: '50%', animation: 'spin 0.8s linear infinite' }} />
          </div>
        ) : payments.length === 0 ? (
          <div style={{ textAlign: 'center', padding: 40, color: 'var(--dim)', fontSize: 13 }}>
            No payments recorded yet. Payments appear here after users subscribe via Stripe.
          </div>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
              <thead>
                <tr style={{ background: 'var(--bg2)', borderBottom: '1px solid var(--border)' }}>
                  {['User','Plan','Amount','Date','Invoice','Status'].map(h => (
                    <th key={h} style={{ padding: '9px 12px', textAlign: 'left', fontSize: 10, color: 'var(--dim)', fontWeight: 700, textTransform: 'uppercase' as const, letterSpacing: '0.5px' }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {payments.map((p, i) => (
                  <tr key={i} style={{ borderBottom: '1px solid var(--border)', transition: 'background 0.12s' }}
                    onMouseEnter={e => (e.currentTarget.style.background = 'var(--row-hover)')}
                    onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}>
                    <td style={{ padding: '10px 12px' }}>
                      <div style={{ fontWeight: 600 }}>{p.userName || p.userEmail || 'Unknown'}</div>
                      <div style={{ fontSize: 11, color: 'var(--dim)' }}>{p.userEmail}</div>
                    </td>
                    <td style={{ padding: '10px 12px' }}>
                      <span style={{ background: p.plan==='platinum'?'rgba(137,87,229,0.12)':'rgba(240,165,0,0.1)', color: p.plan==='platinum'?'var(--purple)':'var(--amber)', fontSize: 11, fontWeight: 700, padding: '2px 8px', borderRadius: 20, textTransform: 'capitalize' as const }}>{p.plan}</span>
                    </td>
                    <td style={{ padding: '10px 12px', fontWeight: 700, color: 'var(--green)' }}>${p.amount?.toFixed(2)}</td>
                    <td style={{ padding: '10px 12px', color: 'var(--muted)', fontSize: 12 }}>{p.date ? new Date(p.date).toLocaleDateString() : '—'}</td>
                    <td style={{ padding: '10px 12px', fontSize: 11, color: 'var(--dim)', fontFamily: 'monospace' }}>{p.stripeInvoiceId ? p.stripeInvoiceId.slice(0, 16) + '...' : '—'}</td>
                    <td style={{ padding: '10px 12px' }}>
                      <span style={{ background: 'rgba(0,200,83,0.1)', color: 'var(--green)', fontSize: 10, fontWeight: 700, padding: '2px 8px', borderRadius: 20 }}>{p.status || 'completed'}</span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  )
}
