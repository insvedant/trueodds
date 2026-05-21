'use client'
import { useEffect, useState } from 'react'
import { api } from '@/lib/auth'

export default function AdminBetsPage() {
  const [data, setData] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [sportFilter, setSportFilter] = useState('')

  useEffect(() => {
    api.get('/admin/bets').then(r => setData(r.data)).catch(() => {}).finally(() => setLoading(false))
  }, [])

  const bets = (data?.bets || []).filter((b: any) =>
    (b.user?.name?.toLowerCase().includes(search.toLowerCase()) || b.game?.toLowerCase().includes(search.toLowerCase())) &&
    (!sportFilter || b.sport === sportFilter)
  )

  const sports = [...new Set((data?.bets || []).map((b: any) => b.sport))]
  const card = { background: 'var(--bg3)', border: '1px solid var(--border)', borderRadius: 10, padding: 18 }

  return (
    <div style={{ maxWidth: 1100 }}>
      <div style={{ marginBottom: 20 }}>
        <h1 style={{ fontSize: 20, fontWeight: 900, marginBottom: 4 }}>All Bets</h1>
        <p style={{ color: 'var(--muted)', fontSize: 12 }}>Platform-wide betting activity</p>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12, marginBottom: 16 }}>
        {[
          { icon: '🎯', label: 'Total Bets', val: data?.bets?.length || 0 },
          { icon: '💵', label: 'Total Staked', val: `$${(data?.totalStaked || 0).toLocaleString()}`, color: 'var(--blue)' },
          { icon: '📈', label: 'Net User P&L', val: `${(data?.totalProfit || 0) >= 0 ? '+' : ''}$${(data?.totalProfit || 0).toLocaleString()}`, color: (data?.totalProfit || 0) >= 0 ? '#00C853' : '#f85149' },
          { icon: '🏈', label: 'Sports', val: sports.length },
        ].map(k => (
          <div key={k.label} style={card}>
            <div style={{ fontSize: 22, marginBottom: 6 }}>{k.icon}</div>
            <div style={{ fontSize: 22, fontWeight: 900, color: (k as any).color || 'var(--text)' }}>{k.val}</div>
            <div style={{ color: 'var(--muted)', fontSize: 12, marginTop: 3 }}>{k.label}</div>
          </div>
        ))}
      </div>

      <div style={{ display: 'flex', gap: 8, marginBottom: 14, flexWrap: 'wrap' }}>
        <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search user or game..." className="input" style={{ width: 200 }} />
        <select value={sportFilter} onChange={e => setSportFilter(e.target.value)} className="input" style={{ width: 140 }}>
          <option value="">All sports</option>
          {sports.map(s => <option key={s as string} value={s as string}>{s as string}</option>)}
        </select>
      </div>

      <div style={{ ...card, overflow: 'auto', padding: 0 }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
          <thead style={{ background: 'var(--bg4)' }}>
            <tr style={{ borderBottom: '1px solid var(--border)' }}>
              {['User', 'Game', 'Sport', 'Book', 'Odds', 'Stake', 'Result', 'P&L', 'Date'].map(h => (
                <th key={h} style={{ padding: '10px 12px', color: 'var(--muted)', fontWeight: 600, fontSize: 11, textAlign: h === 'User' || h === 'Game' ? 'left' : 'center' }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {loading ? <tr><td colSpan={9} style={{ textAlign: 'center', padding: 40, color: 'var(--muted)' }}>Loading...</td></tr>
              : bets.slice(0, 100).map((b: any) => (
              <tr key={b._id} style={{ borderBottom: '1px solid rgba(48,54,61,0.4)' }}>
                <td style={{ padding: '10px 12px' }}>
                  <div style={{ fontWeight: 600, fontSize: 12 }}>{b.user?.name || 'Unknown'}</div>
                  <div style={{ fontSize: 10, color: 'var(--muted)' }}>{b.user?.plan}</div>
                </td>
                <td style={{ padding: '10px 12px' }}>
                  <div style={{ fontWeight: 600, fontSize: 12 }}>{b.game}</div>
                  <div style={{ fontSize: 11, color: 'var(--muted)' }}>{b.market}</div>
                </td>
                <td style={{ padding: '10px 12px', textAlign: 'center', fontSize: 11, color: 'var(--muted)' }}>{b.sport}</td>
                <td style={{ padding: '10px 12px', textAlign: 'center', fontSize: 11, color: 'var(--muted)' }}>{b.book}</td>
                <td style={{ padding: '10px 12px', textAlign: 'center', fontWeight: 600 }}>{b.odds > 0 ? `+${b.odds}` : b.odds}</td>
                <td style={{ padding: '10px 12px', textAlign: 'center' }}>${b.stake}</td>
                <td style={{ padding: '10px 12px', textAlign: 'center' }}>
                  <span className={`badge badge-${b.result === 'win' ? 'green' : b.result === 'loss' ? 'red' : 'amber'}`} style={{ fontSize: 10 }}>{b.result}</span>
                </td>
                <td style={{ padding: '10px 12px', textAlign: 'center', fontWeight: 700, fontSize: 12, color: b.profit > 0 ? '#00C853' : b.profit < 0 ? '#f85149' : 'var(--muted)' }}>
                  {b.result === 'pending' ? '—' : `${b.profit >= 0 ? '+' : ''}$${b.profit}`}
                </td>
                <td style={{ padding: '10px 12px', textAlign: 'center', fontSize: 11, color: 'var(--muted)' }}>{new Date(b.date).toLocaleDateString()}</td>
              </tr>
            ))}
            {!loading && bets.length === 0 && <tr><td colSpan={9} style={{ textAlign: 'center', padding: 40, color: 'var(--muted)' }}>No bets found. Run npm run seed to create test data.</td></tr>}
          </tbody>
        </table>
      </div>
    </div>
  )
}
