'use client'
import { useState, useEffect, useCallback } from 'react'
import { api } from '@/lib/auth'

type Alert = {
  _id: string; type: string; title: string; message: string
  value?: string; sport?: string; read: boolean; createdAt: string
}

const TYPE_META: Record<string, { icon: string; color: string }> = {
  arb:      { icon: '⚡', color: 'var(--green)' },
  ev:       { icon: '📈', color: 'var(--blue)' },
  line:     { icon: '📊', color: 'var(--purple)' },
  sharp:    { icon: '🔴', color: 'var(--red)' },
  system:   { icon: '🔔', color: 'var(--amber)' },
  default:  { icon: '🔔', color: 'var(--muted)' },
}

export default function AlertsPage() {
  const [alerts, setAlerts]   = useState<Alert[]>([])
  const [loading, setLoading] = useState(true)
  const [filter, setFilter]   = useState<'all'|'unread'|'arb'|'ev'>('all')
  const [total, setTotal]     = useState(0)

  const load = useCallback(async () => {
    try {
      const res  = await api.get('/alerts')
      const data = res.data.alerts || res.data.data || []
      setAlerts(data)
      setTotal(res.data.total || data.length)
    } catch {
      setAlerts([])
    } finally { setLoading(false) }
  }, [])

  useEffect(() => { load() }, [load])

  const markRead = async (id: string) => {
    try {
      await api.patch(`/alerts/${id}/read`)
      setAlerts(prev => prev.map(a => a._id === id ? { ...a, read: true } : a))
    } catch {
      setAlerts(prev => prev.map(a => a._id === id ? { ...a, read: true } : a))
    }
  }

  const markAllRead = async () => {
    try { await api.patch('/alerts/read-all') } catch {}
    setAlerts(prev => prev.map(a => ({ ...a, read: true })))
  }

  const dismiss = async (id: string) => {
    try { await api.delete(`/alerts/${id}`) } catch {}
    setAlerts(prev => prev.filter(a => a._id !== id))
  }

  const filtered = alerts.filter(a => {
    if (filter === 'unread') return !a.read
    if (filter === 'arb')    return a.type === 'arb'
    if (filter === 'ev')     return a.type === 'ev'
    return true
  })

  const unreadCount = alerts.filter(a => !a.read).length

  function timeAgo(dateStr: string) {
    const diff = Date.now() - new Date(dateStr).getTime()
    const m    = Math.floor(diff / 60000)
    if (m < 1)  return 'just now'
    if (m < 60) return `${m}m ago`
    const h    = Math.floor(m / 60)
    if (h < 24) return `${h}h ago`
    return `${Math.floor(h / 24)}d ago`
  }

  return (
    <div style={{ padding: '20px 24px', maxWidth: 800 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 20, flexWrap: 'wrap', gap: 12 }}>
        <div>
          <h1 style={{ fontSize: 22, fontWeight: 900, marginBottom: 4 }}>🔔 Alerts</h1>
          <p style={{ color: 'var(--muted)', fontSize: 13 }}>
            {loading ? 'Loading...' : `${unreadCount} unread · ${total} total`}
          </p>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          {unreadCount > 0 && (
            <button onClick={markAllRead} style={{ background: 'var(--bg3)', border: '1px solid var(--border)', color: 'var(--muted)', borderRadius: 7, padding: '7px 14px', fontSize: 12, cursor: 'pointer', fontFamily: 'inherit' }}>
              Mark all read
            </button>
          )}
          <button onClick={load} style={{ background: 'var(--bg3)', border: '1px solid var(--border)', color: 'var(--text)', borderRadius: 7, padding: '7px 14px', fontSize: 12, cursor: 'pointer', fontFamily: 'inherit' }}>
            ↻ Refresh
          </button>
        </div>
      </div>

      {/* Filters */}
      <div style={{ display: 'flex', gap: 8, marginBottom: 16 }}>
        {([['all','All'], ['unread','Unread'], ['arb','Arbs'], ['ev','+EV']] as const).map(([val, label]) => (
          <button key={val} onClick={() => setFilter(val)} style={{ padding: '5px 14px', borderRadius: 20, fontSize: 12, border: 'none', cursor: 'pointer', fontFamily: 'inherit', background: filter === val ? 'var(--green)' : 'var(--bg3)', color: filter === val ? '#000' : 'var(--muted)', fontWeight: filter === val ? 700 : 400 }}>
            {label}
          </button>
        ))}
      </div>

      {/* Alerts list */}
      {loading ? (
        <div style={{ display: 'flex', justifyContent: 'center', padding: 60 }}>
          <div style={{ width: 28, height: 28, border: '3px solid var(--border)', borderTopColor: 'var(--green)', borderRadius: '50%', animation: 'spin 0.8s linear infinite' }} />
          <style>{`@keyframes spin { to { transform:rotate(360deg) } }`}</style>
        </div>
      ) : filtered.length === 0 ? (
        <div style={{ textAlign: 'center', padding: 60, background: 'var(--bg3)', border: '1px solid var(--border)', borderRadius: 12, color: 'var(--dim)' }}>
          <div style={{ fontSize: 32, marginBottom: 10 }}>🔔</div>
          <div style={{ fontSize: 14 }}>No alerts yet — alerts appear when arb and +EV opportunities are detected</div>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {filtered.map(alert => {
            const meta = TYPE_META[alert.type] || TYPE_META.default
            return (
              <div key={alert._id} style={{ background: alert.read ? 'var(--bg3)' : 'rgba(0,200,83,0.04)', border: `1px solid ${alert.read ? 'var(--border)' : 'rgba(0,200,83,0.25)'}`, borderRadius: 12, padding: '14px 16px', display: 'flex', alignItems: 'flex-start', gap: 12, transition: 'all 0.2s' }}>
                <div style={{ width: 36, height: 36, borderRadius: '50%', background: `${meta.color}15`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 18, flexShrink: 0 }}>
                  {meta.icon}
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4, flexWrap: 'wrap' }}>
                    <span style={{ fontWeight: 700, fontSize: 14, color: 'var(--text)' }}>{alert.title || alert.type?.toUpperCase()}</span>
                    {!alert.read && <span style={{ background: 'rgba(0,200,83,0.12)', color: 'var(--green)', fontSize: 9, fontWeight: 800, padding: '2px 7px', borderRadius: 20 }}>NEW</span>}
                    {alert.value && <span style={{ background: `${meta.color}15`, color: meta.color, fontSize: 11, fontWeight: 800, padding: '2px 9px', borderRadius: 20 }}>{alert.value}</span>}
                    {alert.sport && <span style={{ background: 'rgba(88,166,255,0.1)', color: 'var(--blue)', fontSize: 10, padding: '2px 7px', borderRadius: 20 }}>{alert.sport}</span>}
                  </div>
                  <div style={{ fontSize: 13, color: 'var(--muted)', marginBottom: 4 }}>{alert.message}</div>
                  <div style={{ fontSize: 11, color: 'var(--dim)' }}>{timeAgo(alert.createdAt)}</div>
                </div>
                <div style={{ display: 'flex', gap: 6, flexShrink: 0 }}>
                  {!alert.read && (
                    <button onClick={() => markRead(alert._id)} style={{ background: 'none', border: '1px solid var(--border)', color: 'var(--muted)', borderRadius: 6, padding: '4px 10px', fontSize: 11, cursor: 'pointer', fontFamily: 'inherit' }}>
                      ✓ Read
                    </button>
                  )}
                  <button onClick={() => dismiss(alert._id)} style={{ background: 'none', border: 'none', color: 'var(--dim)', cursor: 'pointer', fontSize: 18, padding: '0 4px', lineHeight: 1 }}>×</button>
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
