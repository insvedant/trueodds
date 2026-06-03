'use client'
import { useState, useEffect } from 'react'
import { api } from '@/lib/auth'

type Stats = { basic: number; gold: number; platinum: number; total: number }
type PlanKey = 'basic' | 'gold' | 'platinum'

const PLAN_COLOR: Record<PlanKey, { color: string; bg: string }> = {
  basic:    { color:'#00C853', bg:'rgba(0,200,83,0.1)' },
  gold:     { color:'#f0a500', bg:'rgba(240,165,0,0.1)' },
  platinum: { color:'#8957e5', bg:'rgba(137,87,229,0.1)' },
}

export default function AdminNewsletter() {
  const [stats, setStats]         = useState<Stats|null>(null)
  const [subject, setSubject]     = useState('')
  const [body, setBody]           = useState('')
  const [plans, setPlans]         = useState<PlanKey[]>(['basic','gold','platinum'])
  const [sending, setSending]     = useState(false)
  const [result, setResult]       = useState<any>(null)
  const [previewing, setPreviewing] = useState(false)
  const [previewData, setPreviewData] = useState<any>(null)
  const [tab, setTab]             = useState<'compose'|'preview'>('compose')

  useEffect(() => {
    api.get('/newsletter/stats').then(r => setStats(r.data.data)).catch(()=>{})
  }, [])

  const recipientCount = stats
    ? plans.reduce((sum, p) => sum + (stats[p] || 0), 0)
    : 0

  const togglePlan = (p: PlanKey) => {
    setPlans(prev => prev.includes(p) ? prev.filter(x=>x!==p) : [...prev,p])
  }

  const handlePreview = async () => {
    if (!subject.trim() || !body.trim()) return alert('Fill in subject and body first')
    setPreviewing(true)
    try {
      const r = await api.post('/newsletter/send', { subject, body, plans, preview: true })
      setPreviewData(r.data)
      setTab('preview')
    } catch (err: any) {
      alert('Error: ' + (err.response?.data?.message || err.message))
    } finally { setPreviewing(false) }
  }

  const handleSend = async () => {
    if (!subject.trim() || !body.trim()) return alert('Fill in subject and body')
    if (plans.length === 0) return alert('Select at least one plan')
    if (!confirm(`Send to ${recipientCount} users? This cannot be undone.`)) return
    setSending(true); setResult(null)
    try {
      const r = await api.post('/newsletter/send', { subject, body, plans, preview: false })
      setResult(r.data)
    } catch (err: any) {
      alert('Send failed: ' + (err.response?.data?.message || err.message))
    } finally { setSending(false) }
  }

  const ta: React.CSSProperties = { width:'100%', background:'var(--bg3)', border:'1px solid var(--border)', borderRadius:9, padding:'10px 14px', fontSize:13, color:'var(--text)', fontFamily:'inherit', outline:'none', resize:'vertical' as const, boxSizing:'border-box' as const }

  return (
    <div style={{ padding:'clamp(16px,3vw,28px)', maxWidth:780, margin:'0 auto' }}>
      <style>{`
        @media (max-width: 640px) {
          .nl-stats-grid { grid-template-columns: 1fr 1fr !important; }
          .nl-actions     { flex-direction: column !important; }
          .nl-actions button { width: 100% !important; }
          .nl-plan-chips  { gap: 6px !important; }
        }
        .nl-tab { transition: all 0.15s; cursor: pointer; }
        .nl-tab:hover { background: var(--hover-bg); }
        .plan-chip { transition: all 0.15s; cursor: pointer; user-select: none; }
        .plan-chip:hover { filter: brightness(1.1); }
      `}</style>

      {/* Header */}
      <div style={{ marginBottom:28 }}>
        <h1 style={{ fontSize:22, fontWeight:900, margin:'0 0 6px' }}>📧 Newsletter</h1>
        <p style={{ color:'var(--muted)', fontSize:14, margin:0 }}>Send emails to your registered users by plan tier.</p>
      </div>

      {/* Stats cards */}
      <div className="nl-stats-grid" style={{ display:'grid', gridTemplateColumns:'repeat(4,1fr)', gap:12, marginBottom:28 }}>
        {[
          { label:'Basic subscribers',    val: stats?.basic    ?? '…', color:'#00C853' },
          { label:'Gold subscribers',     val: stats?.gold     ?? '…', color:'#f0a500' },
          { label:'Platinum subscribers', val: stats?.platinum ?? '…', color:'#8957e5' },
          { label:'Total with email',     val: stats?.total    ?? '…', color:'#3b82f6' },
        ].map(s => (
          <div key={s.label} style={{ background:'var(--bg3)', border:'1px solid var(--border)', borderRadius:12, padding:'14px 16px' }}>
            <div style={{ fontSize:24, fontWeight:900, color:s.color, marginBottom:4 }}>{s.val}</div>
            <div style={{ fontSize:11, color:'var(--dim)' }}>{s.label}</div>
          </div>
        ))}
      </div>

      {/* Tabs */}
      <div style={{ display:'flex', gap:4, marginBottom:20, background:'var(--bg3)', padding:4, borderRadius:10, border:'1px solid var(--border)', width:'fit-content' }}>
        {(['compose','preview'] as const).map(t => (
          <button key={t} className="nl-tab" onClick={() => setTab(t)}
            style={{ padding:'7px 20px', borderRadius:7, fontSize:13, fontWeight:700, border:'none', background:tab===t?'var(--bg4)':'transparent', color:tab===t?'var(--text)':'var(--muted)', fontFamily:'inherit', textTransform:'capitalize' }}>
            {t === 'compose' ? '✏️ Compose' : '👁 Preview'}
          </button>
        ))}
      </div>

      {tab === 'compose' && (
        <div style={{ display:'flex', flexDirection:'column' as const, gap:18 }}>

          {/* Recipient plans */}
          <div style={{ background:'var(--bg3)', border:'1px solid var(--border)', borderRadius:12, padding:'18px 20px' }}>
            <div style={{ fontSize:12, fontWeight:700, color:'var(--muted)', marginBottom:12, textTransform:'uppercase' as const }}>Send to</div>
            <div className="nl-plan-chips" style={{ display:'flex', gap:8, flexWrap:'wrap' as const, marginBottom:14 }}>
              {(['basic','gold','platinum'] as PlanKey[]).map(p => {
                const active = plans.includes(p)
                const c = PLAN_COLOR[p]
                return (
                  <div key={p} className="plan-chip" onClick={() => togglePlan(p)}
                    style={{ display:'flex', alignItems:'center', gap:6, padding:'8px 16px', borderRadius:24, border:`2px solid ${active ? c.color : 'var(--border)'}`, background:active ? c.bg : 'var(--bg4)' }}>
                    <span style={{ width:8, height:8, borderRadius:'50%', background:active?c.color:'var(--dim)', flexShrink:0 }} />
                    <span style={{ fontSize:13, fontWeight:700, color:active?c.color:'var(--dim)', textTransform:'capitalize' }}>{p}</span>
                    {stats && <span style={{ fontSize:11, color:active?c.color:'var(--dim)', opacity:0.7 }}>({stats[p]})</span>}
                    {active && <span style={{ fontSize:11, color:c.color, fontWeight:900 }}>✓</span>}
                  </div>
                )
              })}
            </div>
            <div style={{ fontSize:13, color:'var(--muted)', background:'var(--bg4)', borderRadius:8, padding:'8px 12px', display:'inline-flex', alignItems:'center', gap:6 }}>
              <span style={{ color:'var(--green)', fontWeight:700 }}>📨</span>
              Will send to <strong style={{ color:'var(--text)' }}>{recipientCount} users</strong>
            </div>
          </div>

          {/* Subject */}
          <div>
            <label style={{ display:'block', fontSize:12, fontWeight:700, color:'var(--muted)', marginBottom:6, textTransform:'uppercase' as const }}>Subject Line</label>
            <input value={subject} onChange={e => setSubject(e.target.value)}
              placeholder="e.g. 🔥 This week's top arb opportunities on TrueOdds"
              style={{ ...ta, height:42, resize:'none' as const }} />
          </div>

          {/* Body */}
          <div>
            <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:6 }}>
              <label style={{ fontSize:12, fontWeight:700, color:'var(--muted)', textTransform:'uppercase' as const }}>Email Body</label>
              <span style={{ fontSize:11, color:'var(--dim)' }}>{body.length} chars</span>
            </div>
            <textarea value={body} onChange={e => setBody(e.target.value)} rows={12}
              placeholder={`Write your newsletter here...\n\nEach blank line becomes a paragraph break.\n\nExample:\nHey, this week we found 200+ arbitrage opportunities across MLB, NHL playoffs, and FIFA World Cup qualifying.\n\nThe hottest markets right now are:\n- MLB moneylines (DraftKings vs FanDuel)\n- NHL Conference Finals puck lines\n\nLog in now to see all live opportunities.\n\nKeep winning,\nThe TrueOdds Team`}
              style={{ ...ta, minHeight:240 }} />
          </div>

          {/* Quick templates */}
          <div>
            <div style={{ fontSize:11, fontWeight:700, color:'var(--dim)', marginBottom:8, textTransform:'uppercase' as const }}>Quick Templates</div>
            <div style={{ display:'flex', gap:8, flexWrap:'wrap' as const }}>
              {[
                { label:'Weekly Arbs', subject:'🔥 This week\'s top arbitrage opportunities', body:'This week TrueOdds found hundreds of arbitrage opportunities across all major sports.\n\nLog in now to see live arbs, +EV bets, and the best odds across 40+ sportsbooks.\n\nKeep winning,\nThe TrueOdds Team' },
                { label:'New Feature', subject:'🚀 New feature just launched on TrueOdds', body:'We just launched a new feature on TrueOdds that we think you\'ll love.\n\nLog in to your dashboard to check it out.\n\nAs always, feel free to reply to this email with any feedback.\n\nThe TrueOdds Team' },
                { label:'Market Alert', subject:'⚡ High-value arb window open right now', body:'There is an unusually high number of arbitrage opportunities available right now.\n\nLog in to your TrueOdds dashboard to see all live arbs before they close.\n\nThese windows typically last 2–5 minutes.\n\nAct fast,\nThe TrueOdds Team' },
              ].map(t => (
                <button key={t.label} onClick={() => { setSubject(t.subject); setBody(t.body) }}
                  style={{ padding:'5px 14px', borderRadius:20, fontSize:11, fontWeight:600, border:'1px solid var(--border)', background:'var(--bg3)', color:'var(--muted)', cursor:'pointer', fontFamily:'inherit', transition:'all 0.15s' }}>
                  {t.label}
                </button>
              ))}
            </div>
          </div>

          {/* Actions */}
          <div className="nl-actions" style={{ display:'flex', gap:10, paddingTop:8 }}>
            <button onClick={handlePreview} disabled={previewing || !subject.trim() || !body.trim()}
              style={{ padding:'10px 20px', borderRadius:9, fontSize:13, fontWeight:700, border:'1px solid var(--border)', background:'var(--bg3)', color:'var(--text)', cursor:'pointer', fontFamily:'inherit', opacity: (!subject.trim()||!body.trim()) ? 0.4 : 1 }}>
              {previewing ? 'Loading…' : '👁 Preview Recipients'}
            </button>
            <button onClick={handleSend} disabled={sending || plans.length === 0 || !subject.trim() || !body.trim()}
              style={{ padding:'10px 24px', borderRadius:9, fontSize:13, fontWeight:800, border:'none', background: (sending||plans.length===0||!subject.trim()||!body.trim()) ? 'var(--bg4)' : '#00C853', color: (sending||plans.length===0) ? 'var(--dim)' : '#000', cursor:'pointer', fontFamily:'inherit', transition:'all 0.15s' }}>
              {sending ? '⏳ Sending…' : `📤 Send to ${recipientCount} users`}
            </button>
          </div>

          {/* Result */}
          {result && (
            <div style={{ background:result.sent>0?'rgba(0,200,83,0.08)':'rgba(239,68,68,0.08)', border:`1px solid ${result.sent>0?'rgba(0,200,83,0.3)':'rgba(239,68,68,0.3)'}`, borderRadius:10, padding:'16px 20px' }}>
              <div style={{ fontWeight:700, fontSize:14, marginBottom:8, color:result.sent>0?'#00C853':'#ef4444' }}>
                {result.sent > 0 ? '✅ Newsletter sent successfully!' : '❌ Send failed'}
              </div>
              <div style={{ fontSize:13, color:'var(--muted)' }}>
                Sent: <strong style={{ color:'var(--text)' }}>{result.sent}</strong> &nbsp;·&nbsp;
                Failed: <strong style={{ color: result.failed>0?'#ef4444':'var(--text)' }}>{result.failed}</strong> &nbsp;·&nbsp;
                Total: <strong style={{ color:'var(--text)' }}>{result.total}</strong>
              </div>
            </div>
          )}
        </div>
      )}

      {tab === 'preview' && previewData && (
        <div>
          <div style={{ background:'rgba(0,200,83,0.06)', border:'1px solid rgba(0,200,83,0.2)', borderRadius:10, padding:'14px 18px', marginBottom:20 }}>
            <div style={{ fontWeight:700, marginBottom:4 }}>Preview — {previewData.count} recipients</div>
            <div style={{ fontSize:13, color:'var(--muted)' }}>Showing first 5 recipients. Subject: <em>{subject}</em></div>
          </div>
          <div style={{ display:'flex', flexDirection:'column' as const, gap:8, marginBottom:24 }}>
            {(previewData.sample || []).map((u: any, i: number) => (
              <div key={i} style={{ display:'flex', alignItems:'center', gap:12, background:'var(--bg3)', border:'1px solid var(--border)', borderRadius:10, padding:'12px 16px' }}>
                <div style={{ width:36, height:36, borderRadius:'50%', background:PLAN_COLOR[u.plan as PlanKey]?.bg||'var(--bg4)', display:'flex', alignItems:'center', justifyContent:'center', fontSize:14, fontWeight:700, color:PLAN_COLOR[u.plan as PlanKey]?.color||'var(--muted)', flexShrink:0 }}>
                  {(u.name||'?')[0].toUpperCase()}
                </div>
                <div style={{ flex:1 }}>
                  <div style={{ fontSize:13, fontWeight:600 }}>{u.name}</div>
                  <div style={{ fontSize:12, color:'var(--dim)' }}>{u.email}</div>
                </div>
                <span style={{ fontSize:11, fontWeight:700, padding:'2px 10px', borderRadius:20, background:PLAN_COLOR[u.plan as PlanKey]?.bg||'var(--bg4)', color:PLAN_COLOR[u.plan as PlanKey]?.color||'var(--muted)', textTransform:'capitalize' as const }}>{u.plan}</span>
              </div>
            ))}
            {previewData.count > 5 && (
              <div style={{ textAlign:'center', fontSize:13, color:'var(--dim)', padding:12 }}>+ {previewData.count - 5} more recipients</div>
            )}
          </div>
          <div style={{ display:'flex', gap:10 }}>
            <button onClick={() => setTab('compose')} style={{ padding:'10px 20px', borderRadius:9, fontSize:13, fontWeight:700, border:'1px solid var(--border)', background:'var(--bg3)', color:'var(--text)', cursor:'pointer', fontFamily:'inherit' }}>
              ← Back to Compose
            </button>
            <button onClick={handleSend} disabled={sending}
              style={{ padding:'10px 24px', borderRadius:9, fontSize:13, fontWeight:800, border:'none', background:sending?'var(--bg4)':'#00C853', color:sending?'var(--dim)':'#000', cursor:'pointer', fontFamily:'inherit' }}>
              {sending ? '⏳ Sending…' : `📤 Confirm Send to ${previewData.count} users`}
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
