'use client'
import { useState, useEffect, useCallback } from 'react'
import { api, useAuth } from '@/lib/auth'
import UpgradeWall from '@/components/UpgradeWall'

type Alert = {
  _id: string; type: string; title: string; message: string
  value?: string; sport?: string; read: boolean; createdAt: string
}

const TYPE_META: Record<string, { icon: string; color: string }> = {
  arb:     { icon: '⚡', color: '#00C853' },
  ev:      { icon: '📈', color: '#3b82f6' },
  line:    { icon: '📊', color: '#8957e5' },
  sharp:   { icon: '🔴', color: '#ef4444' },
  system:  { icon: '🔔', color: '#f0a500' },
  default: { icon: '🔔', color: '#6b7280' },
}

function Toggle({ on, onChange, color = '#00C853' }: { on: boolean; onChange: () => void; color?: string }) {
  return (
    <button onPointerDown={onChange}
      style={{ width:46, height:26, borderRadius:13, background:on?color:'var(--bg4)', border:'none', cursor:'pointer', position:'relative', transition:'background 0.2s', flexShrink:0, WebkitTapHighlightColor:'transparent' as any }}>
      <span style={{ position:'absolute', top:3, left:on?23:3, width:20, height:20, borderRadius:'50%', background:'#fff', transition:'left 0.2s', display:'block', boxShadow:'0 1px 3px rgba(0,0,0,0.3)' }} />
    </button>
  )
}

export default function AlertsPage() {
  const { user } = useAuth()
  const [alerts, setAlerts]       = useState<Alert[]>([])
  const [loading, setLoading]     = useState(true)
  const [filter, setFilter]       = useState<'all'|'unread'|'arb'|'ev'>('all')
  const [total, setTotal]         = useState(0)
  const [showPrefs, setShowPrefs] = useState(false)
  const [prefs, setPrefs]         = useState({
    emailAlerts: true, arbThreshold: 2.0,
    evThreshold: 3.0, hotDealsOnly: false,
  })
  const [savingPrefs, setSavingPrefs] = useState(false)
  const [prefsMsg, setPrefsMsg]       = useState('')

  const isBasic    = user?.plan === 'basic'
  const isGoldPlus = ['gold','platinum'].includes(user?.plan || '')

  const load = useCallback(async () => {
    try {
      const res  = await api.get('/alerts')
      const data = res.data.alerts || res.data.data || []
      setAlerts(data)
      setTotal(res.data.total || data.length)
    } catch { setAlerts([]) }
    finally { setLoading(false) }
  }, [])

  useEffect(() => { load() }, [load])

  const markRead    = async (id: string) => {
    try { await api.patch(`/alerts/${id}/read`) } catch {}
    setAlerts(prev => prev.map(a => a._id === id ? { ...a, read: true } : a))
  }
  const markAllRead = async () => {
    try { await api.patch('/alerts/read-all') } catch {}
    setAlerts(prev => prev.map(a => ({ ...a, read: true })))
  }
  const dismiss     = async (id: string) => {
    try { await api.delete(`/alerts/${id}`) } catch {}
    setAlerts(prev => prev.filter(a => a._id !== id))
  }

  const savePrefs = async () => {
    setSavingPrefs(true); setPrefsMsg('')
    try {
      await api.put('/alerts/prefs', prefs)
      setPrefsMsg('✓ Saved')
      setTimeout(() => setPrefsMsg(''), 2500)
    } catch { setPrefsMsg('Failed to save') }
    finally { setSavingPrefs(false) }
  }

  const filtered    = alerts.filter(a => {
    if (filter === 'unread') return !a.read
    if (filter === 'arb')    return a.type === 'arb'
    if (filter === 'ev')     return a.type === 'ev'
    return true
  })
  const unreadCount = alerts.filter(a => !a.read).length

  function timeAgo(d: string) {
    const m = Math.floor((Date.now() - new Date(d).getTime()) / 60000)
    if (m < 1)  return 'just now'
    if (m < 60) return `${m}m ago`
    const h = Math.floor(m / 60)
    if (h < 24) return `${h}h ago`
    return `${Math.floor(h/24)}d ago`
  }

  if (user?.plan === 'free') return (
    <UpgradeWall requiredPlan="basic" featureName="Email Alerts"
      featureDesc="Get notified instantly when new arbitrage opportunities and +EV bets appear. Never miss a profitable edge again."
      icon="🔔" currentPlan={user.plan} />
  )

  return (
    <div style={{ padding:'clamp(16px,4vw,24px)', maxWidth:800 }}>
      <style>{`
        @keyframes spin   { to{transform:rotate(360deg)} }
        @keyframes fadeIn { from{opacity:0;transform:translateY(-6px)} to{opacity:1;transform:translateY(0)} }
        @keyframes rowIn  { from{opacity:0;transform:translateX(-6px)} to{opacity:1;transform:translateX(0)} }
        .alert-row { transition:background 0.15s; }
        .alert-row:hover { background:var(--hover-bg)!important; }
        .pref-btn { -webkit-tap-highlight-color:transparent; }
        @media (max-width:480px) {
          .alerts-header { flex-direction:column!important; align-items:flex-start!important; }
          .alerts-actions { width:100%!important; justify-content:flex-start!important; flex-wrap:wrap!important; }
          .filter-row { overflow-x:auto!important; scrollbar-width:none!important; }
          .filter-row::-webkit-scrollbar { display:none!important; }
          .alert-card-actions { flex-direction:column!important; align-items:flex-end!important; gap:4px!important; }
        }
      `}</style>

      {}
      <div className="alerts-header" style={{ display:'flex', justifyContent:'space-between', alignItems:'flex-start', marginBottom:20, gap:12, flexWrap:'wrap' as const }}>
        <div>
          <h1 style={{ fontSize:'clamp(18px,4vw,22px)', fontWeight:900, marginBottom:4 }}>🔔 Alerts</h1>
          <p style={{ color:'var(--muted)', fontSize:13, margin:0 }}>
            {loading ? 'Loading...' : `${unreadCount > 0 ? `${unreadCount} unread · ` : ''}${total} total`}
          </p>
        </div>
        <div className="alerts-actions" style={{ display:'flex', gap:8, alignItems:'center' }}>
          <button onClick={() => setShowPrefs(!showPrefs)} className="pref-btn"
            style={{ background:showPrefs?'var(--green)':'var(--bg3)', border:'1px solid var(--border)', color:showPrefs?'#000':'var(--text)', borderRadius:9, padding:'8px 14px', fontSize:12, cursor:'pointer', fontFamily:'inherit', fontWeight:showPrefs?700:400, transition:'all 0.15s', whiteSpace:'nowrap' as const }}>
            ⚙️ Preferences
          </button>
          {unreadCount > 0 && (
            <button onClick={markAllRead} style={{ background:'var(--bg3)', border:'1px solid var(--border)', color:'var(--muted)', borderRadius:9, padding:'8px 14px', fontSize:12, cursor:'pointer', fontFamily:'inherit', whiteSpace:'nowrap' as const }}>
              ✓ All read
            </button>
          )}
          <button onClick={load} style={{ background:'var(--bg3)', border:'1px solid var(--border)', color:'var(--text)', borderRadius:9, padding:'8px 12px', fontSize:12, cursor:'pointer', fontFamily:'inherit' }}>↻</button>
        </div>
      </div>

      {}
      {showPrefs && (
        <div style={{ background:'var(--bg3)', border:'1px solid var(--border)', borderRadius:14, padding:'clamp(16px,4vw,22px)', marginBottom:20, animation:'fadeIn 0.25s ease' }}>
          <div style={{ fontWeight:800, fontSize:15, marginBottom:18 }}>Email Alert Preferences</div>

          {}
          <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', padding:'12px 14px', background:'var(--bg)', borderRadius:10, marginBottom:12, gap:12 }}>
            <div style={{ minWidth:0 }}>
              <div style={{ fontWeight:700, fontSize:14 }}>Email Notifications</div>
              <div style={{ fontSize:12, color:'var(--dim)', marginTop:2 }}>Receive email alerts for opportunities</div>
            </div>
            <Toggle on={prefs.emailAlerts} onChange={() => setPrefs(p => ({ ...p, emailAlerts:!p.emailAlerts }))} />
          </div>

          {}
          <div style={{ background:'var(--bg)', borderRadius:10, padding:'12px 14px', marginBottom:12 }}>
            <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:10 }}>
              <div>
                <div style={{ fontWeight:700, fontSize:14 }}>Arb Alert Threshold</div>
                <div style={{ fontSize:11, color:'var(--dim)', marginTop:2 }}>
                  {isBasic ? 'Fixed at 2% for Basic plan' : 'Minimum profit % to trigger alert'}
                </div>
              </div>
              <span style={{ fontWeight:900, color:'#00C853', fontSize:16, marginLeft:16 }}>{prefs.arbThreshold}%</span>
            </div>
            <input type="range" min={isBasic?2:1} max={5} step={0.5}
              value={prefs.arbThreshold} disabled={isBasic}
              onChange={e => setPrefs(p => ({ ...p, arbThreshold:parseFloat(e.target.value) }))}
              style={{ width:'100%', accentColor:'#00C853', opacity:isBasic?0.45:1, height:4 }} />
            <div style={{ display:'flex', justifyContent:'space-between', fontSize:10, color:'var(--dim)', marginTop:5 }}>
              <span>{isBasic?'2% min (Basic)':'1% — all arbs'}</span>
              <span>5% — hot only</span>
            </div>
          </div>

          {}
          {isGoldPlus && (
            <div style={{ background:'var(--bg)', borderRadius:10, padding:'12px 14px', marginBottom:12 }}>
              <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:10 }}>
                <div>
                  <div style={{ fontWeight:700, fontSize:14 }}>+EV Alert Threshold</div>
                  <div style={{ fontSize:11, color:'var(--dim)', marginTop:2 }}>Minimum EV% to trigger alert</div>
                </div>
                <span style={{ fontWeight:900, color:'#3b82f6', fontSize:16, marginLeft:16 }}>{prefs.evThreshold}%</span>
              </div>
              <input type="range" min={1} max={10} step={0.5}
                value={prefs.evThreshold}
                onChange={e => setPrefs(p => ({ ...p, evThreshold:parseFloat(e.target.value) }))}
                style={{ width:'100%', accentColor:'#3b82f6', height:4 }} />
              <div style={{ display:'flex', justifyContent:'space-between', fontSize:10, color:'var(--dim)', marginTop:5 }}>
                <span>1% — all +EV bets</span><span>10% — best only</span>
              </div>
            </div>
          )}

          {}
          <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', padding:'12px 14px', background:'var(--bg)', borderRadius:10, marginBottom:18, gap:12 }}>
            <div style={{ minWidth:0 }}>
              <div style={{ fontWeight:700, fontSize:14 }}>🔥 Hot Deals Only (5%+)</div>
              <div style={{ fontSize:12, color:'var(--dim)', marginTop:2 }}>Only notify for exceptional opportunities</div>
            </div>
            <Toggle on={prefs.hotDealsOnly} onChange={() => setPrefs(p => ({ ...p, hotDealsOnly:!p.hotDealsOnly }))} color="#f0a500" />
          </div>

          <div style={{ display:'flex', alignItems:'center', gap:12, flexWrap:'wrap' as const }}>
            <button onClick={savePrefs} disabled={savingPrefs}
              style={{ background:'var(--green)', border:'none', borderRadius:10, padding:'11px 24px', fontSize:14, fontWeight:800, color:'#000', cursor:'pointer', fontFamily:'inherit', opacity:savingPrefs?0.7:1, WebkitTapHighlightColor:'transparent' as any }}>
              {savingPrefs ? 'Saving...' : 'Save Preferences'}
            </button>
            {prefsMsg && <span style={{ fontSize:13, color:prefsMsg.startsWith('✓')?'var(--green)':'#ef4444', fontWeight:600 }}>{prefsMsg}</span>}
          </div>
        </div>
      )}

      {}
      <div style={{ background:'rgba(0,200,83,0.06)', border:'1px solid rgba(0,200,83,0.15)', borderRadius:10, padding:'10px 14px', marginBottom:16, fontSize:12, color:'var(--muted)', display:'flex', alignItems:'flex-start', gap:8, lineHeight:1.6 }}>
        <span style={{ flexShrink:0 }}>📧</span>
        <span>{isBasic
          ? 'Basic: email alerts for arb ≥2%. Upgrade to Gold for +EV alerts and custom thresholds down to 1%.'
          : 'Gold/Platinum: custom thresholds from 1%. Max one email per hour — no spam.'}</span>
      </div>

      {}
      <div className="filter-row" style={{ display:'flex', gap:6, marginBottom:16, WebkitOverflowScrolling:'touch' as any }}>
      {([['all','All'], ['unread', unreadCount>0 ? `Unread (${unreadCount})` : 'Unread'], ['arb','⚡ Arbs'], ['ev','📈 +EV']] as const).map(([val, label]) => (
          <button key={val} onClick={() => setFilter(val)} style={{ padding:'6px 14px', borderRadius:20, fontSize:12, border:'none', cursor:'pointer', fontFamily:'inherit', background:filter===val?'var(--green)':'var(--bg3)', color:filter===val?'#000':'var(--muted)', fontWeight:filter===val?700:400, flexShrink:0, transition:'all 0.15s', WebkitTapHighlightColor:'transparent' as any }}>
            {label}
          </button>
        ))}
      </div>

      {/* List */}
      {loading ? (
        <div style={{ display:'flex', justifyContent:'center', padding:60 }}>
          <div style={{ width:28, height:28, border:'3px solid var(--border)', borderTopColor:'var(--green)', borderRadius:'50%', animation:'spin 0.8s linear infinite' }} />
        </div>
      ) : filtered.length === 0 ? (
        <div style={{ textAlign:'center', padding:'clamp(32px,8vw,64px) 20px', background:'var(--bg3)', border:'1px solid var(--border)', borderRadius:14, color:'var(--dim)' }}>
          <div style={{ fontSize:40, marginBottom:12, opacity:0.3 }}>🔔</div>
          <div style={{ fontSize:14, fontWeight:600, marginBottom:8 }}>No alerts yet</div>
          <div style={{ fontSize:13 }}>Email alerts fire automatically when arb and +EV opportunities hit your threshold</div>
        </div>
      ) : (
        <div style={{ display:'flex', flexDirection:'column' as const, gap:8 }}>
          {filtered.map((alert, i) => {
            const meta = TYPE_META[alert.type] || TYPE_META.default
            return (
              <div key={alert._id} className="alert-row"
                style={{ background:alert.read?'var(--bg3)':'rgba(0,200,83,0.04)', border:`1px solid ${alert.read?'var(--border)':'rgba(0,200,83,0.22)'}`, borderRadius:12, padding:'clamp(12px,3vw,16px)', display:'flex', alignItems:'flex-start', gap:12, animation:`rowIn 0.2s ease ${i*30}ms both` }}>
                {/* Icon */}
                <div style={{ width:38, height:38, borderRadius:'50%', background:`${meta.color}18`, display:'flex', alignItems:'center', justifyContent:'center', fontSize:18, flexShrink:0 }}>
                  {meta.icon}
                </div>
                {/* Content */}
                <div style={{ flex:1, minWidth:0 }}>
                  <div style={{ display:'flex', alignItems:'center', gap:6, marginBottom:4, flexWrap:'wrap' as const }}>
                    <span style={{ fontWeight:700, fontSize:'clamp(12px,2.5vw,14px)', color:'var(--text)', overflow:'hidden', textOverflow:'ellipsis' }}>{alert.title}</span>
                    {!alert.read && <span style={{ background:'rgba(0,200,83,0.12)', color:'var(--green)', fontSize:9, fontWeight:800, padding:'2px 6px', borderRadius:20, flexShrink:0 }}>NEW</span>}
                  </div>
                  <div style={{ display:'flex', gap:6, marginBottom:5, flexWrap:'wrap' as const }}>
                    {alert.value && <span style={{ background:`${meta.color}18`, color:meta.color, fontSize:11, fontWeight:800, padding:'2px 8px', borderRadius:20 }}>{alert.value}</span>}
                    {alert.sport && <span style={{ background:'rgba(88,166,255,0.1)', color:'#3b82f6', fontSize:10, padding:'2px 7px', borderRadius:20 }}>{alert.sport}</span>}
                  </div>
                  <div style={{ fontSize:13, color:'var(--muted)', lineHeight:1.5, marginBottom:5 }}>{alert.message}</div>
                  <div style={{ fontSize:11, color:'var(--dim)' }}>{timeAgo(alert.createdAt)}</div>
                </div>
                {/* Actions */}
                <div className="alert-card-actions" style={{ display:'flex', gap:6, flexShrink:0 }}>
                  {!alert.read && (
                    <button onClick={() => markRead(alert._id)}
                      style={{ background:'none', border:'1px solid var(--border)', color:'var(--muted)', borderRadius:7, padding:'5px 10px', fontSize:11, cursor:'pointer', fontFamily:'inherit', whiteSpace:'nowrap' as const, WebkitTapHighlightColor:'transparent' as any }}>
                      ✓
                    </button>
                  )}
                  <button onClick={() => dismiss(alert._id)}
                    style={{ background:'none', border:'none', color:'var(--dim)', cursor:'pointer', fontSize:20, padding:'0 4px', lineHeight:1, WebkitTapHighlightColor:'transparent' as any }}>
                    ×
                  </button>
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
