'use client'
import { useState, useEffect, useCallback } from 'react'
import { api } from '@/lib/auth'
import { useWinCelebration } from '@/components/Celebrations'

type Bet = {
  _id: string; game: string; sport: string; market: string
  book: string; odds: string; stake: number; result: 'win'|'loss'|'pending'
  profit: number; betType: string; date: string; notes?: string
}

type Stats = {
  totalBets: number; settledBets: number; wins: number; losses: number
  pending: number; totalStake: number; totalProfit: number; roi: number; winRate: number
}

const SPORTS  = ['NFL','NBA','MLB','NHL','Soccer','UFC','Tennis']
const RESULTS = ['win','loss','pending'] as const
const BET_TYPES = ['standard','arbitrage','ev','parlay']

function StatCard({ label, val, color = 'var(--text)', sub = '' }: any) {
  return (
    <div style={{ background: 'var(--bg3)', border: '1px solid var(--border)', borderRadius: 10, padding: '14px 16px' }}>
      <div style={{ fontSize: 22, fontWeight: 900, color }}>{val}</div>
      <div style={{ color: 'var(--muted)', fontSize: 12, marginTop: 3 }}>{label}</div>
      {sub && <div style={{ fontSize: 11, color: 'var(--dim)', marginTop: 2 }}>{sub}</div>}
    </div>
  )
}

export default function TrackerPage() {
  const [bets, setBets]       = useState<Bet[]>([])
  const [stats, setStats]     = useState<Stats | null>(null)
  const [daily, setDaily]     = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [sportFilter, setSportFilter]   = useState('All')
  const [resultFilter, setResultFilter] = useState('all')
  const [form, setForm] = useState({ game:'', sport:'NFL', market:'Moneyline', book:'', odds:'', stake:'', betType:'standard', notes:'' })
  const [saving, setSaving] = useState(false)

  const { triggerWin, Celebrations } = useWinCelebration()

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const [betsRes, statsRes] = await Promise.allSettled([
        api.get('/bets?limit=100'),
        api.get('/analytics/overview?period=30d'),
      ])
      if (betsRes.status   === 'fulfilled') setBets(betsRes.value.data.bets || betsRes.value.data.data || [])
      if (statsRes.status  === 'fulfilled') {
        setStats(statsRes.value.data.overview)
        setDaily(statsRes.value.data.daily || [])
      }
    } finally { setLoading(false) }
  }, [])

  useEffect(() => { load() }, [load])

  const addBet = async () => {
    if (!form.game || !form.odds || !form.stake) return
    setSaving(true)
    try {
      await api.post('/bets', {
        game:    form.game,
        sport:   form.sport,
        market:  form.market,
        book:    form.book,
        odds:    parseInt(form.odds),
        stake:   parseFloat(form.stake),
        betType: form.betType,
        notes:   form.notes,
        result:  'pending',
      })
      setForm({ game:'', sport:'NFL', market:'Moneyline', book:'', odds:'', stake:'', betType:'standard', notes:'' })
      setShowForm(false)
      await load()
    } catch (e: any) {
      alert(e.response?.data?.message || 'Failed to save bet')
    } finally { setSaving(false) }
  }

  const updateResult = async (id: string, result: string) => {
    try {
      await api.patch(`/bets/${id}`, { result })
      setBets(prev => prev.map(b => b._id === id ? { ...b, result: result as any } : b))
      // Trigger win celebration 🎉
      if (result === 'win') {
        const bet = bets.find(b => b._id === id)
        const profit = bet ? `+$${Math.abs(bet.profit || bet.stake * 0.1).toFixed(0)}` : ''
        triggerWin('Bet Won! 🏆', profit || undefined)
      }
      await load()
    } catch {}
  }

  const deleteBet = async (id: string) => {
    if (!confirm('Delete this bet?')) return
    try {
      await api.delete(`/bets/${id}`)
      setBets(prev => prev.filter(b => b._id !== id))
      await load()
    } catch {}
  }

  const filtered = bets.filter(b =>
    (sportFilter === 'All' || b.sport === sportFilter) &&
    (resultFilter === 'all' || b.result === resultFilter)
  )

  const maxAbs = Math.max(...daily.map(d => Math.abs(d.profit)), 1)

  const inp: React.CSSProperties = { width: '100%', background: 'var(--bg)', border: '1px solid var(--border2)', borderRadius: 8, padding: '9px 12px', color: 'var(--text)', fontSize: 13, outline: 'none', fontFamily: 'inherit' }

  return (
    <div style={{ padding: '20px 24px' }}>
      <Celebrations />
      <style>{`@keyframes spin { to { transform:rotate(360deg) } }`}</style>

      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 20, flexWrap: 'wrap', gap: 12 }}>
        <div>
          <h1 style={{ fontSize: 22, fontWeight: 900, marginBottom: 4 }}>📋 Bet Tracker</h1>
          <p style={{ color: 'var(--muted)', fontSize: 13 }}>{loading ? 'Loading...' : `${bets.length} bets tracked`}</p>
        </div>
        <button onClick={() => setShowForm(!showForm)} style={{ background: 'var(--green)', color: '#000', border: 'none', borderRadius: 9, padding: '10px 22px', fontSize: 14, fontWeight: 800, cursor: 'pointer', fontFamily: 'inherit' }}>
          + Add Bet
        </button>
      </div>

      {/* Stats */}
      {stats && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(150px,1fr))', gap: 12, marginBottom: 20 }}>
          <StatCard label="Total P&L"   val={`${stats.totalProfit >= 0?'+':''}$${stats.totalProfit?.toFixed(0)}`} color={stats.totalProfit >= 0 ? 'var(--green)' : 'var(--red)'} />
          <StatCard label="ROI"          val={`${stats.roi >= 0?'+':''}${stats.roi}%`}                             color={stats.roi >= 0 ? 'var(--green)' : 'var(--red)'} />
          <StatCard label="Win Rate"     val={`${stats.winRate}%`}                                                  color="var(--blue)"   sub={`${stats.wins}W / ${stats.losses}L`} />
          <StatCard label="Total Staked" val={`$${stats.totalStake?.toFixed(0)}`}                                  sub={`${stats.settledBets} settled`} />
          <StatCard label="Pending"      val={stats.pending}                                                        color="var(--amber)" />
        </div>
      )}

      {/* P&L chart */}
      {daily.length > 0 && (
        <div style={{ background: 'var(--bg3)', border: '1px solid var(--border)', borderRadius: 12, padding: '16px 18px', marginBottom: 20 }}>
          <div style={{ fontWeight: 700, fontSize: 14, marginBottom: 10 }}>P&L Last 30 Days</div>
          <div style={{ display: 'flex', alignItems: 'flex-end', gap: 3, height: 60 }}>
            {daily.map((d, i) => {
              const h = Math.max(3, (Math.abs(d.profit) / maxAbs) * 56)
              return <div key={i} title={`${d.date}: ${d.profit >= 0?'+':''}$${d.profit.toFixed(0)}`} style={{ flex: 1, height: h, background: d.profit >= 0 ? 'var(--green)' : 'var(--red)', borderRadius: '2px 2px 0 0', opacity: 0.8, minWidth: 3, cursor: 'pointer' }} />
            })}
          </div>
        </div>
      )}

      {/* Add bet form */}
      {showForm && (
        <div style={{ background: 'var(--bg3)', border: '1px solid var(--green)', borderRadius: 12, padding: '20px', marginBottom: 20 }}>
          <div style={{ fontWeight: 800, fontSize: 15, marginBottom: 14 }}>Add New Bet</div>
          <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr 1fr', gap: 10, marginBottom: 10 }}>
            <div>
              <label style={{ fontSize: 11, fontWeight: 700, color: 'var(--muted)', display: 'block', marginBottom: 4, textTransform: 'uppercase' as const }}>Game / Event</label>
              <input value={form.game} onChange={e => setForm({...form, game: e.target.value})} placeholder="e.g. Chiefs vs Ravens" style={inp} />
            </div>
            <div>
              <label style={{ fontSize: 11, fontWeight: 700, color: 'var(--muted)', display: 'block', marginBottom: 4, textTransform: 'uppercase' as const }}>Sport</label>
              <select value={form.sport} onChange={e => setForm({...form, sport: e.target.value})} style={{ ...inp, cursor: 'pointer' }}>
                {SPORTS.map(s => <option key={s}>{s}</option>)}
              </select>
            </div>
            <div>
              <label style={{ fontSize: 11, fontWeight: 700, color: 'var(--muted)', display: 'block', marginBottom: 4, textTransform: 'uppercase' as const }}>Market</label>
              <input value={form.market} onChange={e => setForm({...form, market: e.target.value})} placeholder="Moneyline" style={inp} />
            </div>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr 1fr', gap: 10, marginBottom: 10 }}>
            <div>
              <label style={{ fontSize: 11, fontWeight: 700, color: 'var(--muted)', display: 'block', marginBottom: 4, textTransform: 'uppercase' as const }}>Book</label>
              <input value={form.book} onChange={e => setForm({...form, book: e.target.value})} placeholder="DraftKings" style={inp} />
            </div>
            <div>
              <label style={{ fontSize: 11, fontWeight: 700, color: 'var(--muted)', display: 'block', marginBottom: 4, textTransform: 'uppercase' as const }}>Odds</label>
              <input value={form.odds} onChange={e => setForm({...form, odds: e.target.value})} placeholder="-110 or +150" style={inp} />
            </div>
            <div>
              <label style={{ fontSize: 11, fontWeight: 700, color: 'var(--muted)', display: 'block', marginBottom: 4, textTransform: 'uppercase' as const }}>Stake ($)</label>
              <input type="number" value={form.stake} onChange={e => setForm({...form, stake: e.target.value})} placeholder="100" style={inp} />
            </div>
            <div>
              <label style={{ fontSize: 11, fontWeight: 700, color: 'var(--muted)', display: 'block', marginBottom: 4, textTransform: 'uppercase' as const }}>Bet Type</label>
              <select value={form.betType} onChange={e => setForm({...form, betType: e.target.value})} style={{ ...inp, cursor: 'pointer' }}>
                {BET_TYPES.map(t => <option key={t} value={t}>{t.charAt(0).toUpperCase()+t.slice(1)}</option>)}
              </select>
            </div>
          </div>
          <div style={{ marginBottom: 14 }}>
            <label style={{ fontSize: 11, fontWeight: 700, color: 'var(--muted)', display: 'block', marginBottom: 4, textTransform: 'uppercase' as const }}>Notes (optional)</label>
            <input value={form.notes} onChange={e => setForm({...form, notes: e.target.value})} placeholder="Any notes about this bet..." style={inp} />
          </div>
          <div style={{ display: 'flex', gap: 10 }}>
            <button onClick={addBet} disabled={saving || !form.game || !form.odds || !form.stake} style={{ background: 'var(--green)', color: '#000', border: 'none', borderRadius: 8, padding: '10px 24px', fontSize: 14, fontWeight: 800, cursor: 'pointer', fontFamily: 'inherit', opacity: saving ? 0.7 : 1 }}>
              {saving ? 'Saving...' : '+ Add Bet'}
            </button>
            <button onClick={() => setShowForm(false)} style={{ background: 'transparent', border: '1px solid var(--border)', color: 'var(--muted)', borderRadius: 8, padding: '10px 18px', fontSize: 14, cursor: 'pointer', fontFamily: 'inherit' }}>
              Cancel
            </button>
          </div>
        </div>
      )}

      {/* Filters */}
      <div style={{ display: 'flex', gap: 8, marginBottom: 14, flexWrap: 'wrap', alignItems: 'center' }}>
        {['All', ...SPORTS].map(s => (
          <button key={s} onClick={() => setSportFilter(s)} style={{ padding: '5px 12px', borderRadius: 20, fontSize: 11, border: 'none', cursor: 'pointer', fontFamily: 'inherit', background: sportFilter === s ? 'var(--green)' : 'var(--bg3)', color: sportFilter === s ? '#000' : 'var(--muted)', fontWeight: sportFilter === s ? 700 : 400 }}>{s}</button>
        ))}
        <div style={{ marginLeft: 'auto', display: 'flex', gap: 6 }}>
          {(['all','win','loss','pending'] as const).map(r => (
            <button key={r} onClick={() => setResultFilter(r)} style={{ padding: '5px 12px', borderRadius: 20, fontSize: 11, border: 'none', cursor: 'pointer', fontFamily: 'inherit', background: resultFilter === r ? 'var(--bg4)' : 'transparent', color: r === 'win' ? 'var(--green)' : r === 'loss' ? 'var(--red)' : r === 'pending' ? 'var(--amber)' : 'var(--muted)', fontWeight: resultFilter === r ? 700 : 400, textTransform: 'capitalize' as const }}>{r}</button>
          ))}
        </div>
      </div>

      {/* Bets table */}
      {loading ? (
        <div style={{ display: 'flex', justifyContent: 'center', padding: 60 }}>
          <div style={{ width: 28, height: 28, border: '3px solid var(--border)', borderTopColor: 'var(--green)', borderRadius: '50%', animation: 'spin 0.8s linear infinite' }} />
        </div>
      ) : filtered.length === 0 ? (
        <div style={{ textAlign: 'center', padding: 60, background: 'var(--bg3)', border: '1px solid var(--border)', borderRadius: 12, color: 'var(--dim)' }}>
          <div style={{ fontSize: 32, marginBottom: 10 }}>📋</div>
          <div style={{ fontSize: 14 }}>No bets yet — click "+ Add Bet" to log your first bet</div>
        </div>
      ) : (
        <div style={{ background: 'var(--bg3)', border: '1px solid var(--border)', borderRadius: 12, overflow: 'hidden' }}>
          <div style={{ display: 'grid', gridTemplateColumns: '2fr 70px 70px 80px 100px 80px 40px', padding: '9px 14px', background: 'var(--bg2)', borderBottom: '1px solid var(--border)', fontSize: 10, color: 'var(--dim)', fontWeight: 700, textTransform: 'uppercase' as const, letterSpacing: '0.5px', gap: 8 }}>
            <span>Event</span><span>Odds</span><span>Stake</span><span>Result</span><span>Profit</span><span>Date</span><span></span>
          </div>
          {filtered.map(bet => (
            <div key={bet._id} style={{ display: 'grid', gridTemplateColumns: '2fr 70px 70px 80px 100px 80px 40px', padding: '11px 14px', borderBottom: '1px solid var(--border)', alignItems: 'center', gap: 8, transition: 'background 0.12s' }}
              onMouseEnter={e => (e.currentTarget.style.background = 'var(--row-hover)')}
              onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}>
              <div>
                <div style={{ fontWeight: 600, fontSize: 13, color: 'var(--text)', marginBottom: 2 }}>{bet.game}</div>
                <div style={{ fontSize: 11, color: 'var(--muted)' }}>{bet.sport} · {bet.market} · {bet.book}</div>
              </div>
              <span style={{ fontWeight: 700, color: typeof bet.odds === 'string' && bet.odds.startsWith('+') ? 'var(--green)' : 'var(--red)', fontSize: 13 }}>{bet.odds}</span>
              <span style={{ fontSize: 13 }}>${bet.stake}</span>
              <select value={bet.result} onChange={e => updateResult(bet._id, e.target.value)} style={{ background: bet.result==='win'?'rgba(0,200,83,0.12)':bet.result==='loss'?'rgba(248,81,73,0.1)':'rgba(240,165,0,0.1)', color: bet.result==='win'?'var(--green)':bet.result==='loss'?'var(--red)':'var(--amber)', border:'none', borderRadius:20, padding:'4px 8px', fontSize:11, fontWeight:700, cursor:'pointer', fontFamily:'inherit', width:'100%' }}>
                {RESULTS.map(r => <option key={r} value={r}>{r.charAt(0).toUpperCase()+r.slice(1)}</option>)}
              </select>
              <span style={{ fontWeight: 700, color: bet.profit > 0 ? 'var(--green)' : bet.profit < 0 ? 'var(--red)' : 'var(--dim)', fontSize: 14 }}>
                {bet.result === 'pending' ? '—' : `${bet.profit >= 0?'+':''}$${bet.profit?.toFixed(0)}`}
              </span>
              <span style={{ fontSize: 11, color: 'var(--dim)' }}>{new Date(bet.date).toLocaleDateString()}</span>
              <button onClick={() => deleteBet(bet._id)} style={{ background: 'none', border: 'none', color: 'var(--dim)', cursor: 'pointer', fontSize: 16 }}>×</button>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
