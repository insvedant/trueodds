'use client'
import { useEffect, useState } from 'react'
import { api } from '@/lib/auth'

export default function AdminUsersPage() {
  const [users, setUsers] = useState<any[]>([])
  const [total, setTotal] = useState(0)
  const [search, setSearch] = useState('')
  const [planFilter, setPlanFilter] = useState('')
  const [loading, setLoading] = useState(true)
  const [selected, setSelected] = useState<any>(null)
  const [editForm, setEditForm] = useState<any>({})
  const [saving, setSaving] = useState(false)

  const load = async () => {
    setLoading(true)
    try {
      const res = await api.get('/admin/users', { params: { search: search || undefined, plan: planFilter || undefined, limit: 20 } })
      setUsers(res.data.users); setTotal(res.data.total)
    } catch { setUsers([]) }
    finally { setLoading(false) }
  }

  useEffect(() => { load() }, [planFilter])
  useEffect(() => { const t = setTimeout(load, 400); return () => clearTimeout(t) }, [search])

  const openUser = async (id: string) => {
    try {
      const res = await api.get(`/admin/users/${id}`)
      setSelected(res.data)
      setEditForm({ plan: res.data.user.plan, subscriptionStatus: res.data.user.subscriptionStatus, isActive: res.data.user.isActive })
    } catch {}
  }

  const saveUser = async () => {
    if (!selected) return
    setSaving(true)
    try {
      await api.put(`/admin/users/${selected.user._id}`, editForm)
      load(); openUser(selected.user._id)
    } catch {}
    finally { setSaving(false) }
  }

  const deleteUser = async (id: string) => {
    if (!confirm('Delete this user permanently?')) return
    try { await api.delete(`/admin/users/${id}`); setSelected(null); load() } catch {}
  }

  const PLAN_COLOR: Record<string, string> = { free: 'var(--muted)', gold: '#f0a500', platinum: '#8957e5' }
  const STATUS_COLOR: Record<string, string> = { active: '#00C853', inactive: 'var(--muted)', cancelled: '#f85149', trial: '#58a6ff' }

  return (
    <div style={{ display: 'flex', gap: 16, height: 'calc(100vh - 48px)', overflow: 'hidden' }}>
      {/* List */}
      <div style={{ flex: 1, minWidth: 0, overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, marginBottom: 16, flexWrap: 'wrap' }}>
          <div>
            <h1 style={{ fontSize: 20, fontWeight: 900, marginBottom: 2 }}>Users</h1>
            <p style={{ color: 'var(--muted)', fontSize: 12 }}>{total} total users</p>
          </div>
          <div style={{ display: 'flex', gap: 8 }}>
            <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search..." className="input" style={{ width: 180 }} />
            <select value={planFilter} onChange={e => setPlanFilter(e.target.value)} className="input" style={{ width: 120 }}>
              <option value="">All plans</option>
              <option value="free">Free</option><option value="gold">Gold</option><option value="platinum">Platinum</option>
            </select>
          </div>
        </div>

        <div style={{ background: 'var(--bg3)', border: '1px solid var(--border)', borderRadius: 10, overflow: 'auto', flex: 1 }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
            <thead style={{ position: 'sticky', top: 0, background: 'var(--bg4)' }}>
              <tr style={{ borderBottom: '1px solid var(--border)' }}>
                {['User', 'Plan', 'Status', 'Paid', 'Bets', 'Joined', ''].map(h => (
                  <th key={h} style={{ padding: '10px 12px', color: 'var(--muted)', fontWeight: 600, fontSize: 11, textAlign: h === 'User' ? 'left' : 'center' }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan={7} style={{ textAlign: 'center', padding: 40, color: 'var(--muted)' }}>Loading users...</td></tr>
              ) : users.map(u => (
                <tr key={u._id} onClick={() => openUser(u._id)} style={{ borderBottom: '1px solid rgba(48,54,61,0.5)', cursor: 'pointer', background: selected?.user?._id === u._id ? 'rgba(0,200,83,0.04)' : 'transparent' }}
                  onMouseEnter={e => { if (selected?.user?._id !== u._id) e.currentTarget.style.background = 'var(--row-hover)' }}
                  onMouseLeave={e => { if (selected?.user?._id !== u._id) e.currentTarget.style.background = 'transparent' }}
                >
                  <td style={{ padding: '11px 12px' }}>
                    <div style={{ fontWeight: 600 }}>{u.name}</div>
                    <div style={{ fontSize: 11, color: 'var(--muted)' }}>{u.email}</div>
                  </td>
                  <td style={{ padding: '11px 12px', textAlign: 'center' }}>
                    <span style={{ background: PLAN_COLOR[u.plan] + '22', color: PLAN_COLOR[u.plan], padding: '2px 8px', borderRadius: 20, fontSize: 11, fontWeight: 700, textTransform: 'uppercase' }}>{u.plan}</span>
                  </td>
                  <td style={{ padding: '11px 12px', textAlign: 'center' }}>
                    <span style={{ background: STATUS_COLOR[u.subscriptionStatus] + '22', color: STATUS_COLOR[u.subscriptionStatus], padding: '2px 8px', borderRadius: 20, fontSize: 11 }}>{u.subscriptionStatus}</span>
                  </td>
                  <td style={{ padding: '11px 12px', textAlign: 'center', color: 'var(--green)', fontWeight: 700 }}>${u.totalPaid || 0}</td>
                  <td style={{ padding: '11px 12px', textAlign: 'center', color: 'var(--muted)' }}>{u.betStats?.total || 0}</td>
                  <td style={{ padding: '11px 12px', textAlign: 'center', color: 'var(--muted)', fontSize: 11 }}>{new Date(u.createdAt).toLocaleDateString()}</td>
                  <td style={{ padding: '11px 12px', textAlign: 'center' }}>
                    <button onClick={e => { e.stopPropagation(); deleteUser(u._id) }} style={{ background: 'none', border: 'none', color: 'var(--dim)', cursor: 'pointer', fontSize: 15 }}>🗑</button>
                  </td>
                </tr>
              ))}
              {!loading && users.length === 0 && <tr><td colSpan={7} style={{ textAlign: 'center', padding: 40, color: 'var(--muted)' }}>No users found.</td></tr>}
            </tbody>
          </table>
        </div>
      </div>

      {/* Detail panel */}
      {selected && (
        <div style={{ width: 300, background: 'var(--bg3)', border: '1px solid var(--border)', borderRadius: 10, padding: 20, overflowY: 'auto', flexShrink: 0 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 16 }}>
            <span style={{ fontWeight: 700, fontSize: 14 }}>User Detail</span>
            <button onClick={() => setSelected(null)} style={{ background: 'none', border: 'none', color: 'var(--muted)', cursor: 'pointer', fontSize: 20, lineHeight: 1 }}>×</button>
          </div>
          <div style={{ width: 48, height: 48, borderRadius: '50%', background: 'rgba(0,200,83,0.15)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 20, fontWeight: 700, color: 'var(--green)', marginBottom: 10 }}>
            {selected.user.name.charAt(0)}
          </div>
          <div style={{ fontWeight: 800, fontSize: 16, marginBottom: 2 }}>{selected.user.name}</div>
          <div style={{ color: 'var(--muted)', fontSize: 12, marginBottom: 16 }}>{selected.user.email}</div>

          {/* Edit fields */}
          <div style={{ marginBottom: 12 }}>
            <label style={{ fontSize: 11, color: 'var(--muted)', display: 'block', marginBottom: 4 }}>Plan</label>
            <select value={editForm.plan} onChange={e => setEditForm({ ...editForm, plan: e.target.value })} className="input" style={{ fontSize: 12 }}>
              <option value="free">Free</option><option value="gold">Gold</option><option value="platinum">Platinum</option>
            </select>
          </div>
          <div style={{ marginBottom: 12 }}>
            <label style={{ fontSize: 11, color: 'var(--muted)', display: 'block', marginBottom: 4 }}>Status</label>
            <select value={editForm.subscriptionStatus} onChange={e => setEditForm({ ...editForm, subscriptionStatus: e.target.value })} className="input" style={{ fontSize: 12 }}>
              <option value="active">Active</option><option value="inactive">Inactive</option><option value="cancelled">Cancelled</option><option value="trial">Trial</option>
            </select>
          </div>
          <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 12, color: 'var(--text2)', cursor: 'pointer', marginBottom: 14 }}>
            <input type="checkbox" checked={editForm.isActive} onChange={e => setEditForm({ ...editForm, isActive: e.target.checked })} />
            Account Active
          </label>
          <button className="btn-primary" style={{ width: '100%', marginBottom: 8, fontSize: 13, opacity: saving ? 0.6 : 1 }} onClick={saveUser} disabled={saving}>
            {saving ? 'Saving...' : '✓ Save Changes'}
          </button>
          <button onClick={() => deleteUser(selected.user._id)} style={{ width: '100%', background: 'rgba(248,81,73,0.1)', border: '1px solid rgba(248,81,73,0.3)', color: 'var(--red)', borderRadius: 7, padding: '8px', fontSize: 12, cursor: 'pointer' }}>
            🗑 Delete User
          </button>

          {selected.bets?.length > 0 && (
            <div style={{ marginTop: 16 }}>
              <div style={{ fontWeight: 700, fontSize: 13, marginBottom: 8 }}>Recent Bets</div>
              {selected.bets.slice(0, 4).map((b: any) => (
                <div key={b._id} style={{ background: 'var(--surface)', borderRadius: 6, padding: 10, marginBottom: 6 }}>
                  <div style={{ fontWeight: 600, fontSize: 12 }}>{b.game}</div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, color: 'var(--muted)', marginTop: 2 }}>
                    <span>{b.book} · ${b.stake}</span>
                    <span style={{ color: b.profit > 0 ? '#00C853' : b.profit < 0 ? '#f85149' : '#f0a500', fontWeight: 700 }}>
                      {b.result === 'pending' ? 'Pending' : `${b.profit >= 0 ? '+' : ''}$${b.profit}`}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  )
}
