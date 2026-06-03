'use client'
import { useState, useEffect } from 'react'
import { api } from '@/lib/auth'

type Book = {
  _id: string; sportsbook_id: string; displayName: string
  affiliateUrl: string; baseUrl: string; logoColor: string
  markets: string[]; active: boolean; clicks: number; lastClickAt: string | null
}

const inp: React.CSSProperties = {
  width:'100%', background:'var(--bg)', border:'1px solid var(--border)',
  borderRadius:8, padding:'9px 11px', fontSize:14, color:'var(--text)',
  fontFamily:'inherit', boxSizing:'border-box' as const, outline:'none',
}
const lbl: React.CSSProperties = {
  display:'block', fontSize:11, fontWeight:700, color:'var(--muted)',
  marginBottom:5, textTransform:'uppercase' as const, letterSpacing:0.5,
}

export default function AdminAffiliatesPage() {
  const [books, setBooks]     = useState<Book[]>([])
  const [loading, setLoading] = useState(true)
  const [editing, setEditing] = useState<Book | null>(null)
  const [saving, setSaving]   = useState(false)
  const [msg, setMsg]         = useState('')
  const [err, setErr]         = useState('')
  const [showAdd, setShowAdd] = useState(false)
  const [newBook, setNewBook] = useState({
    sportsbook_id:'', displayName:'', affiliateUrl:'',
    baseUrl:'', logoColor:'#333', markets:'US,CA',
  })

  const load = async () => {
    try { const r = await api.get('/affiliates'); setBooks(r.data.books || []) }
    catch {} finally { setLoading(false) }
  }

  useEffect(() => { load() }, [])

  const saveEdit = async () => {
    if (!editing) return
    setSaving(true); setMsg(''); setErr('')
    try {
      await api.put(`/affiliates/${editing._id}`, editing)
      setMsg('Saved'); setEditing(null); load()
      setTimeout(() => setMsg(''), 3000)
    } catch (e: any) { setErr(e.response?.data?.message || 'Failed') }
    finally { setSaving(false) }
  }

  const toggleActive = async (book: Book) => {
    try { await api.put(`/affiliates/${book._id}`, { active: !book.active }); load() } catch {}
  }

  const deleteBook = async (id: string) => {
    if (!confirm('Delete this sportsbook?')) return
    try { await api.delete(`/affiliates/${id}`); load() } catch {}
  }

  const addBook = async (e: React.FormEvent) => {
    e.preventDefault(); setSaving(true); setErr('')
    try {
      await api.post('/affiliates', {
        ...newBook, markets: newBook.markets.split(',').map(m => m.trim()),
      })
      setShowAdd(false)
      setNewBook({ sportsbook_id:'', displayName:'', affiliateUrl:'', baseUrl:'', logoColor:'#333', markets:'US,CA' })
      load()
    } catch (e: any) { setErr(e.response?.data?.message || 'Failed') }
    finally { setSaving(false) }
  }

  const totalClicks = books.reduce((s, b) => s + (b.clicks || 0), 0)

  return (
    <div style={{ padding:'clamp(14px,4vw,24px)' }}>
      <style>{`
        .aff-inp:focus { border-color:var(--green)!important; box-shadow:0 0 0 3px rgba(0,200,83,0.1)!important; }
        .aff-card { transition:background 0.12s; }

        /* Desktop: table view */
        .aff-desktop { display:block; }
        .aff-mobile-cards { display:none; }

        @media (max-width:700px) {
          .aff-desktop { display:none!important; }
          .aff-mobile-cards { display:flex!important; }
          .add-grid { grid-template-columns:1fr!important; }
          .edit-grid { grid-template-columns:1fr!important; }
          .stats-grid { grid-template-columns:1fr 1fr!important; }
          .aff-header { flex-direction:column!important; align-items:flex-start!important; }
        }
      `}</style>

      {/* Header */}
      <div className="aff-header" style={{ display:'flex', alignItems:'flex-start', justifyContent:'space-between', marginBottom:20, gap:12, flexWrap:'wrap' as const }}>
        <div>
          <h1 style={{ fontSize:'clamp(18px,4vw,22px)', fontWeight:900, marginBottom:4 }}>🔗 Affiliate Links</h1>
          <p style={{ color:'var(--muted)', fontSize:13, margin:0 }}>
            {books.length} sportsbooks · {totalClicks.toLocaleString()} total clicks
          </p>
        </div>
        <button onClick={() => setShowAdd(!showAdd)}
          style={{ background:'var(--green)', border:'none', borderRadius:9, padding:'10px 18px', fontSize:13, fontWeight:800, color:'#000', cursor:'pointer', fontFamily:'inherit', flexShrink:0 }}>
          + Add Sportsbook
        </button>
      </div>

      {msg && <div style={{ background:'rgba(0,200,83,0.08)', border:'1px solid rgba(0,200,83,0.2)', borderRadius:8, padding:'9px 14px', color:'var(--green)', fontSize:13, marginBottom:14 }}>✓ {msg}</div>}
      {err && <div style={{ background:'rgba(239,68,68,0.08)', border:'1px solid rgba(239,68,68,0.2)', borderRadius:8, padding:'9px 14px', color:'#ef4444', fontSize:13, marginBottom:14 }}>⚠️ {err}</div>}

      {/* Add form */}
      {showAdd && (
        <div style={{ background:'var(--bg3)', border:'1px solid var(--border)', borderRadius:12, padding:'clamp(14px,3vw,20px)', marginBottom:16 }}>
          <div style={{ fontWeight:800, fontSize:14, marginBottom:14 }}>Add New Sportsbook</div>
          <form onSubmit={addBook}>
            <div className="add-grid" style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:12, marginBottom:14 }}>
              {[
                { key:'sportsbook_id', label:'ID (lowercase)',     ph:'draftkings' },
                { key:'displayName',   label:'Display Name',       ph:'DraftKings' },
                { key:'affiliateUrl',  label:'Affiliate URL',      ph:'https://draftkings.com?ref=XXX' },
                { key:'baseUrl',       label:'Base URL',           ph:'https://sportsbook.draftkings.com' },
                { key:'logoColor',     label:'Brand Color',        ph:'#53d337' },
                { key:'markets',       label:'Markets (US, CA)',   ph:'US,CA' },
              ].map(({ key, label, ph }) => (
                <div key={key} style={{ gridColumn: key==='affiliateUrl'||key==='baseUrl' ? '1 / -1' : 'auto' }}>
                  <label style={lbl}>{label}</label>
                  <input className="aff-inp" style={inp} placeholder={ph}
                    value={newBook[key as keyof typeof newBook]}
                    onChange={e => setNewBook(p => ({ ...p, [key]: e.target.value }))} />
                </div>
              ))}
            </div>
            <div style={{ display:'flex', gap:8, flexWrap:'wrap' as const }}>
              <button type="submit" disabled={saving}
                style={{ background:'var(--green)', border:'none', borderRadius:8, padding:'10px 20px', fontSize:13, fontWeight:800, color:'#000', cursor:'pointer', fontFamily:'inherit' }}>
                {saving ? 'Adding...' : '+ Add'}
              </button>
              <button type="button" onClick={() => setShowAdd(false)}
                style={{ background:'var(--bg)', border:'1px solid var(--border)', borderRadius:8, padding:'10px 20px', fontSize:13, color:'var(--muted)', cursor:'pointer', fontFamily:'inherit' }}>
                Cancel
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Stats */}
      <div className="stats-grid" style={{ display:'grid', gridTemplateColumns:'repeat(auto-fit,minmax(140px,1fr))', gap:10, marginBottom:16 }}>
        {[
          { label:'Total Books', val:books.length,                                          color:'var(--text)' },
          { label:'Active',      val:books.filter(b=>b.active).length,                      color:'var(--green)' },
          { label:'Total Clicks',val:totalClicks.toLocaleString(),                          color:'#3b82f6' },
          { label:'Top Book',    val:[...books].sort((a,b)=>b.clicks-a.clicks)[0]?.displayName||'—', color:'#f0a500' },
        ].map(s => (
          <div key={s.label} style={{ background:'var(--bg3)', border:'1px solid var(--border)', borderRadius:10, padding:'12px 14px' }}>
            <div style={{ fontSize:'clamp(16px,3vw,20px)', fontWeight:900, color:s.color }}>{s.val}</div>
            <div style={{ fontSize:11, color:'var(--dim)', marginTop:3 }}>{s.label}</div>
          </div>
        ))}
      </div>

      {/* Edit panel */}
      {editing && (
        <div style={{ background:'var(--bg3)', border:'1px solid var(--green)', borderRadius:12, padding:'clamp(14px,3vw,20px)', marginBottom:16 }}>
          <div style={{ fontWeight:800, fontSize:14, marginBottom:14 }}>✏️ Editing: {editing.displayName}</div>
          <div className="edit-grid" style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:12, marginBottom:14 }}>
            {[
              { key:'displayName',  label:'Display Name', full:false },
              { key:'logoColor',    label:'Brand Color',  full:false },
              { key:'affiliateUrl', label:'Affiliate URL (your affiliate link here)', full:true },
              { key:'baseUrl',      label:'Base URL',     full:false },
              { key:'markets',      label:'Markets (comma separated)', full:false },
            ].map(({ key, label, full }) => (
              <div key={key} style={{ gridColumn: full ? '1 / -1' : 'auto' }}>
                <label style={lbl}>{label}</label>
                <input className="aff-inp" style={inp}
                  value={key === 'markets'
                    ? (editing.markets || []).join(',')
                    : (editing[key as keyof Book] as string) || ''}
                  onChange={e => setEditing(p => p ? {
                    ...p,
                    [key]: key === 'markets'
                      ? e.target.value.split(',').map(m => m.trim())
                      : e.target.value,
                  } : p)} />
              </div>
            ))}
          </div>
          <div style={{ background:'rgba(59,130,246,0.06)', border:'1px solid rgba(59,130,246,0.15)', borderRadius:8, padding:'8px 12px', marginBottom:14, fontSize:12, color:'#3b82f6' }}>
            ℹ️ UTM params are appended automatically on every click.
          </div>
          <div style={{ display:'flex', gap:8, flexWrap:'wrap' as const }}>
            <button onClick={saveEdit} disabled={saving}
              style={{ background:'var(--green)', border:'none', borderRadius:8, padding:'10px 20px', fontSize:13, fontWeight:800, color:'#000', cursor:'pointer', fontFamily:'inherit' }}>
              {saving ? 'Saving...' : '💾 Save'}
            </button>
            <button onClick={() => setEditing(null)}
              style={{ background:'var(--bg)', border:'1px solid var(--border)', borderRadius:8, padding:'10px 20px', fontSize:13, color:'var(--muted)', cursor:'pointer', fontFamily:'inherit' }}>
              Cancel
            </button>
          </div>
        </div>
      )}

      {loading ? (
        <div style={{ textAlign:'center', padding:48, color:'var(--dim)' }}>Loading...</div>
      ) : (
        <>
          {/* ── DESKTOP: table ── */}
          <div className="aff-desktop" style={{ background:'var(--bg3)', border:'1px solid var(--border)', borderRadius:12, overflow:'hidden' }}>
            <div style={{ display:'grid', gridTemplateColumns:'190px 1fr 70px 70px 90px 110px', padding:'8px 16px', background:'var(--bg2)', borderBottom:'1px solid var(--border)', fontSize:10, fontWeight:700, color:'var(--dim)', letterSpacing:0.6, textTransform:'uppercase' as const, gap:8 }}>
              <span>Sportsbook</span><span>Affiliate URL</span><span>Markets</span><span>Clicks</span><span>Status</span><span>Actions</span>
            </div>
            {books.map((book, i) => (
              <div key={book._id} className="aff-card"
                style={{ display:'grid', gridTemplateColumns:'190px 1fr 70px 70px 90px 110px', padding:'11px 16px', borderBottom: i < books.length-1 ? '1px solid var(--border)' : 'none', alignItems:'center', gap:8 }}>
                <div style={{ display:'flex', alignItems:'center', gap:8, minWidth:0 }}>
                  <div style={{ width:10, height:10, borderRadius:'50%', background:book.logoColor, flexShrink:0 }} />
                  <span style={{ fontWeight:700, fontSize:13, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' as const }}>{book.displayName}</span>
                </div>
                <div style={{ fontSize:11, color:'var(--dim)', overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' as const }}>
                  {book.affiliateUrl || <span style={{ color:'#ef4444' }}>No URL set</span>}
                </div>
                <div style={{ display:'flex', gap:3, flexWrap:'wrap' as const }}>
                  {(book.markets||[]).map(m => (
                    <span key={m} style={{ background:'var(--bg4)', fontSize:9, fontWeight:700, padding:'1px 5px', borderRadius:20, color:'var(--muted)' }}>{m}</span>
                  ))}
                </div>
                <div style={{ fontWeight:700, fontSize:13, color:'#3b82f6' }}>{(book.clicks||0).toLocaleString()}</div>
                <button onClick={() => toggleActive(book)}
                  style={{ background:book.active?'rgba(0,200,83,0.1)':'rgba(239,68,68,0.1)', border:`1px solid ${book.active?'rgba(0,200,83,0.3)':'rgba(239,68,68,0.3)'}`, color:book.active?'var(--green)':'#ef4444', borderRadius:6, padding:'4px 8px', fontSize:11, fontWeight:700, cursor:'pointer', fontFamily:'inherit' }}>
                  {book.active ? 'Active' : 'Inactive'}
                </button>
                <div style={{ display:'flex', gap:5 }}>
                  <button onClick={() => setEditing(book)}
                    style={{ background:'var(--bg)', border:'1px solid var(--border)', borderRadius:7, padding:'5px 10px', fontSize:11, cursor:'pointer', fontFamily:'inherit', color:'var(--text)' }}>✏️</button>
                  <button onClick={() => deleteBook(book._id)}
                    style={{ background:'rgba(239,68,68,0.08)', border:'1px solid rgba(239,68,68,0.2)', borderRadius:7, padding:'5px 9px', fontSize:11, cursor:'pointer', color:'#ef4444', fontFamily:'inherit' }}>✕</button>
                </div>
              </div>
            ))}
          </div>

          {/* ── MOBILE: cards ── */}
          <div className="aff-mobile-cards" style={{ flexDirection:'column', gap:10, display:'none' }}>
            {books.map(book => (
              <div key={book._id} style={{ background:'var(--bg3)', border:'1px solid var(--border)', borderRadius:12, padding:'14px 16px' }}>
                {/* Top row */}
                <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:10, gap:10 }}>
                  <div style={{ display:'flex', alignItems:'center', gap:8, minWidth:0 }}>
                    <div style={{ width:12, height:12, borderRadius:'50%', background:book.logoColor, flexShrink:0 }} />
                    <span style={{ fontWeight:800, fontSize:14, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' as const }}>{book.displayName}</span>
                    <span style={{ fontSize:10, color:'#3b82f6', fontWeight:700, flexShrink:0 }}>{(book.clicks||0)} clicks</span>
                  </div>
                  <div style={{ display:'flex', gap:5, flexShrink:0 }}>
                    {(book.markets||[]).map(m => (
                      <span key={m} style={{ background:'var(--bg4)', fontSize:10, fontWeight:700, padding:'2px 7px', borderRadius:20, color:'var(--muted)' }}>{m}</span>
                    ))}
                  </div>
                </div>

                {/* Affiliate URL */}
                <div style={{ fontSize:12, color:'var(--dim)', marginBottom:12, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' as const, background:'var(--bg)', borderRadius:7, padding:'7px 10px' }}>
                  {book.affiliateUrl || <span style={{ color:'#ef4444' }}>⚠️ No affiliate URL — tap Edit to add</span>}
                </div>

                {/* Actions row */}
                <div style={{ display:'flex', gap:8, flexWrap:'wrap' as const }}>
                  <button onClick={() => { setEditing(book); window.scrollTo({ top:0, behavior:'smooth' }) }}
                    style={{ flex:1, background:'var(--bg)', border:'1px solid var(--border)', borderRadius:9, padding:'9px 14px', fontSize:13, fontWeight:700, cursor:'pointer', fontFamily:'inherit', color:'var(--text)', WebkitTapHighlightColor:'transparent' as any }}>
                    ✏️ Edit Link
                  </button>
                  <button onClick={() => toggleActive(book)}
                    style={{ flex:1, background:book.active?'rgba(0,200,83,0.1)':'rgba(239,68,68,0.1)', border:`1px solid ${book.active?'rgba(0,200,83,0.25)':'rgba(239,68,68,0.25)'}`, color:book.active?'var(--green)':'#ef4444', borderRadius:9, padding:'9px 14px', fontSize:13, fontWeight:700, cursor:'pointer', fontFamily:'inherit', WebkitTapHighlightColor:'transparent' as any }}>
                    {book.active ? '✓ Active' : '✗ Inactive'}
                  </button>
                  <button onClick={() => deleteBook(book._id)}
                    style={{ background:'rgba(239,68,68,0.08)', border:'1px solid rgba(239,68,68,0.2)', borderRadius:9, padding:'9px 12px', fontSize:13, cursor:'pointer', color:'#ef4444', fontFamily:'inherit', WebkitTapHighlightColor:'transparent' as any }}>
                    🗑
                  </button>
                </div>
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  )
}
