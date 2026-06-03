'use client'
import { useState, useEffect } from 'react'
import { api } from '@/lib/auth'

type Post = {
  _id?: string; id?: string; title: string; slug: string; category: string
  status: 'draft' | 'published'; excerpt: string; body?: string; content?: string
  author: string; date?: string; createdAt?: string; readTime: number; tags: string[]
  emoji?: string
}

const DEFAULT_CATEGORIES = ['Strategy', 'Guide', 'News', 'Analysis', 'Tips', 'Tool Updates']

const INITIAL_POSTS: Post[] = [
  { id:'1', title:'What is Arbitrage Betting?', slug:'what-is-arbitrage-betting', category:'Guide', status:'published', excerpt:'Arbitrage betting lets you guarantee profit by backing all outcomes at different sportsbooks.', body:'Arbitrage betting (also called "arbing" or "sure betting") is a strategy where you place bets on all possible outcomes of an event across different sportsbooks that have priced the odds in a way that guarantees a profit regardless of the result.\n\nThe key is finding situations where sportsbooks disagree on the probability of an outcome.\n\n## How to calculate an arb\n\nConvert American odds to decimal, then sum the inverse probabilities. If the sum is less than 1.0, you have an arb.\n\n## Real example\n\nDraftKings offers Minnesota Wild at +322 and FanDuel offers Colorado Avalanche at -280. Sum of implied probs = 0.974. That\'s a +2.6% arb!', author:'TrueOdds Team', date:'2024-01-10', readTime:6, tags:['arbitrage','beginners','strategy'] },
  { id:'2', title:'Positive EV Betting Explained', slug:'positive-ev-betting-explained', category:'Strategy', status:'published', excerpt:'Expected value betting is the most sustainable long-term sports betting strategy.', body:'Positive Expected Value (+EV) betting means placing bets where the price offered by a sportsbook is higher than the true probability of the outcome.\n\n## The formula\n\nEV = (True probability × Decimal odds) − 1\n\nIf a sportsbook offers +145 on a bet with a true probability of 45%, then EV = +10.25%.', author:'TrueOdds Team', date:'2024-01-05', readTime:8, tags:['expected value','strategy','kelly criterion'] },
  { id:'3', title:'Best Sportsbooks for Arb Betting 2024', slug:'best-sportsbooks-arb-2024', category:'Analysis', status:'draft', excerpt:'Not all sportsbooks are equal for arb bettors. Here are the ones with the most generous limits.', body:'When arbitrage betting, your choice of sportsbooks matters enormously.\n\n## Top picks\n\n**Pinnacle** — The sharpest book. Use as reference for true odds.\n**DraftKings** — High limits, slow to restrict.\n**FanDuel** — Great for parlays and same-game parlays.', author:'TrueOdds Team', date:'2024-01-15', readTime:10, tags:['sportsbooks','arbitrage','review'] },
]

function slugify(str: string) {
  return str.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '')
}

const inp = (extra = {}) => ({
  background: 'var(--bg2)', border: '1px solid var(--border)', borderRadius: 8,
  padding: '9px 12px', color: 'var(--text)', fontSize: 13, outline: 'none',
  fontFamily: 'inherit', width: '100%', transition: 'border-color 0.15s, box-shadow 0.15s',
  boxSizing: 'border-box' as const, ...extra,
} as React.CSSProperties)

export default function AdminBlogPage() {
  const [posts, setPosts]             = useState<Post[]>([])
  const [apiLoading, setApiLoading]   = useState(true)
  const [categories, setCategories]   = useState<string[]>(DEFAULT_CATEGORIES)
  const [newCat, setNewCat]           = useState('')

  useEffect(() => {
    api.get('/blog/admin/all')
      .then(r => setPosts(r.data.data || []))
      .catch(() => {})
      .finally(() => setApiLoading(false))
  }, [])
  const [view, setView] = useState<'list' | 'editor' | 'preview'>('list')
  const [editing, setEditing] = useState<Post | null>(null)
  const [filter, setFilter] = useState<'all' | 'published' | 'draft'>('all')
  const [search, setSearch] = useState('')
  const [saved, setSaved] = useState(false)
  const [settingsOpen, setSettingsOpen] = useState(false)

  const filtered = posts.filter(p =>
    (filter === 'all' || p.status === filter) &&
    (p.title.toLowerCase().includes(search.toLowerCase()) || p.category.toLowerCase().includes(search.toLowerCase()))
  )

  const newPost = (): Post => ({
    id: Date.now().toString(), title: '', slug: '', category: 'Strategy',
    status: 'draft', excerpt: '', body: '', author: 'TrueOdds Team',
    date: new Date().toISOString().split('T')[0], readTime: 5, tags: [],
  })

  const openEditor = (post: Post) => { setEditing({ ...post }); setView('editor'); setSaved(false); setSettingsOpen(false) }
  const openNew    = () => { setEditing(newPost()); setView('editor'); setSaved(false); setSettingsOpen(false) }

  const updateField = (key: keyof Post, val: any) => {
    if (!editing) return
    const updated = { ...editing, [key]: val }
    if (key === 'title') updated.slug = slugify(val)
    setEditing(updated); setSaved(false)
  }

  const save = async (overrideStatus?: 'published' | 'draft') => {
    if (!editing) return
    try {
      const payload = {
        title:    editing.title,
        slug:     editing.slug || slugify(editing.title),
        excerpt:  editing.excerpt,
        content:  editing.body || editing.content || '',
        category: editing.category,
        status:   overrideStatus || editing.status,
        readTime: editing.readTime,
        tags:     editing.tags,
        author:   editing.author,
        emoji:      editing.emoji || '📖',
      }
      let savedPost: any
      if ((editing as any)._id) {
        const r = await api.put(`/blog/${(editing as any)._id}`, payload)
        savedPost = r.data.data
        setPosts(prev => prev.map(p => (p as any)._id === (editing as any)._id ? savedPost : p))
      } else {
        const r = await api.post('/blog', payload)
        savedPost = r.data.data
        setPosts(prev => [savedPost, ...prev])
      }
      if (savedPost) {
        setEditing(savedPost)
        setSaved(true)
        return savedPost
      }
    } catch (err: any) {
      alert('Save failed: ' + (err.response?.data?.message || err.message || 'Unknown error'))
    }
  }

  const publish = async () => {
    if (!editing) return
    // Save with published status — works for both new and existing posts
    const saved = await save('published')
    if (saved) {
      setEditing({ ...saved, status: 'published' })
      setSaved(true)
    }
  }

  const deletePost = async (id: string) => {
    if (!confirm('Delete this post permanently?')) return
    try {
      await api.delete(`/blog/${id}`)
      setPosts(prev => prev.filter(p => (p as any)._id !== id))
      if ((editing as any)?._id === id) { setEditing(null); setView('list') }
    } catch (err: any) { alert('Delete failed: ' + (err.response?.data?.message || err.message)) }
  }

  const card: React.CSSProperties = { background: 'var(--bg3)', border: '1px solid var(--border)', borderRadius: 12, padding: 'clamp(14px,3vw,20px)', marginBottom: 14 }

  
  if (view === 'list') return (
    <div style={{ maxWidth: 1000 }}>
      <style>{`
        @keyframes fadeIn { from{opacity:0;transform:translateY(8px)} to{opacity:1;transform:translateY(0)} }
        .blog-input:focus { border-color: var(--green) !important; box-shadow: 0 0 0 3px rgba(0,200,83,0.1) !important; }
        .post-card { transition: transform 0.2s, box-shadow 0.2s; animation: fadeIn 0.3s ease; }
        .post-card:hover { transform: translateY(-2px); box-shadow: 0 8px 24px rgba(0,0,0,0.25); }
        @media (max-width: 640px) {
          .post-card-inner { flex-direction: column !important; }
          .post-card-actions { flex-direction: row !important; width: 100% !important; }
          .post-card-actions button { flex: 1 !important; }
          .blog-filters { flex-wrap: wrap !important; }
          .blog-search { width: 100% !important; }
        }
      `}</style>

      <div style={{ display:'flex', alignItems:'flex-start', justifyContent:'space-between', marginBottom:24, flexWrap:'wrap', gap:12 }}>
        <div>
          <h1 style={{ fontSize:'clamp(18px,4vw,22px)', fontWeight:900, marginBottom:4 }}>✍️ Blog Manager</h1>
          <p style={{ color:'var(--muted)', fontSize:13 }}>{posts.filter(p=>p.status==='published').length} published · {posts.filter(p=>p.status==='draft').length} drafts</p>
        </div>
        <button onClick={openNew} style={{ background:'var(--green)', color:'#000', border:'none', borderRadius:9, padding:'10px 22px', fontSize:14, fontWeight:900, cursor:'pointer', fontFamily:'inherit', transition:'transform 0.2s', flexShrink:0 }}
          onMouseEnter={e=>(e.currentTarget.style.transform='scale(1.04)')}
          onMouseLeave={e=>(e.currentTarget.style.transform='scale(1)')}>
          + New Post
        </button>
      </div>

      <div className="blog-filters" style={{ display:'flex', gap:8, marginBottom:16, alignItems:'center', flexWrap:'wrap' as const }}>
        {(['all','published','draft'] as const).map(f => (
          <button key={f} onClick={() => setFilter(f)} style={{ padding:'6px 16px', borderRadius:20, fontSize:12, fontWeight:700, cursor:'pointer', fontFamily:'inherit', border:'none', background: filter===f ? 'var(--green)' : 'var(--bg3)', color: filter===f ? '#000' : 'var(--muted)', textTransform:'capitalize', transition:'all 0.15s', flexShrink:0 }}>{f}</button>
        ))}
        <input className="blog-input blog-search" value={search} onChange={e => setSearch(e.target.value)} placeholder="Search posts..." style={{ ...inp(), width:200, minWidth:140 }} />
        <span style={{ marginLeft:'auto', fontSize:12, color:'var(--muted)', flexShrink:0 }}>{filtered.length} posts</span>
      </div>

      {/* Category Manager */}
      <div style={{ background:'var(--bg3)', border:'1px solid var(--border)', borderRadius:10, padding:'12px 16px', marginBottom:18 }}>
        <div style={{ fontSize:11, fontWeight:700, color:'var(--muted)', marginBottom:10, textTransform:'uppercase' as const }}>📂 Manage Categories</div>
        <div style={{ display:'flex', gap:6, flexWrap:'wrap' as const, marginBottom:10 }}>
          {categories.map(cat => (
            <span key={cat} style={{ display:'inline-flex', alignItems:'center', gap:5, background:'var(--bg4)', border:'1px solid var(--border)', borderRadius:20, padding:'3px 10px', fontSize:12 }}>
              {cat}
              {!DEFAULT_CATEGORIES.includes(cat) && (
                <button onClick={() => setCategories(prev => prev.filter(c => c !== cat))}
                  style={{ background:'none', border:'none', color:'var(--dim)', cursor:'pointer', fontSize:13, lineHeight:1, padding:0, marginLeft:2 }}>×</button>
              )}
            </span>
          ))}
        </div>
        <div style={{ display:'flex', gap:6 }}>
          <input value={newCat} onChange={e => setNewCat(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter' && newCat.trim() && !categories.includes(newCat.trim())) { setCategories(prev => [...prev, newCat.trim()]); setNewCat('') }}}
            placeholder="New category name..." style={{ ...inp(), flex:1, fontSize:12 }} />
          <button onClick={() => { if (newCat.trim() && !categories.includes(newCat.trim())) { setCategories(prev => [...prev, newCat.trim()]); setNewCat('') }}}
            style={{ background:'var(--green)', color:'#000', border:'none', borderRadius:7, padding:'6px 14px', fontSize:12, fontWeight:700, cursor:'pointer', fontFamily:'inherit', flexShrink:0 }}>
            + Add
          </button>
        </div>
      </div>

      {filtered.map(post => (
        <div key={post.id} className="post-card" style={{ ...card }}>
          <div className="post-card-inner" style={{ display:'flex', alignItems:'flex-start', justifyContent:'space-between', gap:16 }}>
            <div style={{ flex:1, minWidth:0 }}>
              <div style={{ display:'flex', alignItems:'center', gap:8, marginBottom:8, flexWrap:'wrap' }}>
                <span style={{ background: post.status==='published' ? 'rgba(0,200,83,0.12)' : 'rgba(240,165,0,0.1)', color: post.status==='published' ? 'var(--green)' : 'var(--amber)', fontSize:10, fontWeight:800, padding:'2px 8px', borderRadius:20, textTransform:'uppercase' }}>{post.status}</span>
                <span style={{ background:'var(--bg4)', color:'var(--muted)', fontSize:10, padding:'2px 8px', borderRadius:20 }}>{post.category}</span>
                <span style={{ color:'var(--dim)', fontSize:11 }}>{post.date} · {post.readTime} min</span>
              </div>
              <div style={{ fontWeight:800, fontSize:'clamp(14px,2.5vw,16px)', marginBottom:6, color:'var(--text)' }}>{post.title || '(Untitled)'}</div>
              <div style={{ fontSize:13, color:'var(--muted)', marginBottom:8, lineHeight:1.6, display:'-webkit-box', WebkitLineClamp:2, WebkitBoxOrient:'vertical' as any, overflow:'hidden' }}>{post.excerpt}</div>
              <div style={{ display:'flex', gap:6, flexWrap:'wrap' }}>
                {post.tags.map(t => <span key={t} style={{ background:'var(--bg4)', color:'var(--dim)', fontSize:10, padding:'2px 8px', borderRadius:20 }}>#{t}</span>)}
              </div>
            </div>
            <div className="post-card-actions" style={{ display:'flex', flexDirection:'column', gap:6, flexShrink:0 }}>
              <button onClick={() => openEditor(post)} style={{ background:'var(--green)', color:'#000', border:'none', borderRadius:7, padding:'7px 16px', fontSize:12, fontWeight:700, cursor:'pointer', fontFamily:'inherit', whiteSpace:'nowrap' as const }}>Edit</button>
              <button onClick={() => { openEditor(post); setView('preview') }} style={{ background:'var(--bg4)', color:'var(--text)', border:'1px solid var(--border)', borderRadius:7, padding:'7px 14px', fontSize:12, cursor:'pointer', fontFamily:'inherit' }}>Preview</button>
              <button onClick={() => deletePost((post as any)._id)} style={{ background:'rgba(220,38,38,0.08)', color:'var(--red)', border:'1px solid rgba(220,38,38,0.2)', borderRadius:7, padding:'7px 14px', fontSize:12, cursor:'pointer', fontFamily:'inherit' }}>Delete</button>
            </div>
          </div>
        </div>
      ))}

      {filtered.length === 0 && (
        <div style={{ textAlign:'center', padding:60, color:'var(--dim)', background:'var(--bg3)', border:'1px solid var(--border)', borderRadius:12 }}>
          No posts found.{' '}
          <button onClick={openNew} style={{ background:'none', border:'none', color:'var(--green)', cursor:'pointer', fontFamily:'inherit', fontWeight:700 }}>Create your first post →</button>
        </div>
      )}
    </div>
  )

  
  if (view === 'editor' && editing) return (
    <div style={{ maxWidth: 900 }}>
      <style>{`
        @keyframes slideDown { from{opacity:0;transform:translateY(-8px)} to{opacity:1;transform:translateY(0)} }
        .blog-input:focus { border-color: var(--green) !important; box-shadow: 0 0 0 3px rgba(0,200,83,0.1) !important; }
        .editor-grid { display: grid; grid-template-columns: 1fr 280px; gap: 16px; }
        .settings-panel { display: block !important; }
        .settings-toggle { display: none !important; }
        @media (max-width: 700px) {
          .editor-grid { grid-template-columns: 1fr !important; }
          .editor-sidebar { order: -1; }
          .settings-panel { display: none !important; }
          .settings-panel.open { display: block !important; animation: slideDown 0.3s ease; }
          .settings-toggle { display: flex !important; }
          .topbar-actions { flex-wrap: wrap; }
          .topbar-actions button { font-size: 11px !important; padding: 6px 10px !important; }
        }
      `}</style>

      {}
      <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:20, gap:10, flexWrap:'wrap' as const }}>
        <div style={{ display:'flex', alignItems:'center', gap:10, minWidth:0 }}>
          <button onClick={() => setView('list')} style={{ background:'var(--bg3)', border:'1px solid var(--border)', color:'var(--muted)', borderRadius:7, padding:'7px 14px', fontSize:12, cursor:'pointer', fontFamily:'inherit', flexShrink:0 }}>← Back</button>
          <div style={{ fontSize:13, fontWeight:700, color:'var(--text)', overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' as const }}>{editing.id && posts.find(p=>p.id===editing.id) ? 'Editing post' : 'New post'}</div>
          {saved && <span style={{ color:'var(--green)', fontSize:12, fontWeight:600, flexShrink:0 }}>✓ Saved</span>}
        </div>
        <div className="topbar-actions" style={{ display:'flex', gap:8, flexShrink:0, flexWrap:'wrap' as const }}>
          {}
          <button className="settings-toggle" onClick={() => setSettingsOpen(!settingsOpen)}
            style={{ display:'none', background: settingsOpen ? 'rgba(0,200,83,0.1)' : 'var(--bg3)', border:`1px solid ${settingsOpen ? 'var(--green)' : 'var(--border)'}`, color: settingsOpen ? 'var(--green)' : 'var(--text)', borderRadius:7, padding:'7px 12px', fontSize:12, cursor:'pointer', fontFamily:'inherit', alignItems:'center', gap:6 }}>
            ⚙️ Settings
          </button>
          <button onClick={() => setView('preview')} style={{ background:'var(--bg3)', border:'1px solid var(--border)', color:'var(--text)', borderRadius:7, padding:'7px 14px', fontSize:12, cursor:'pointer', fontFamily:'inherit' }}>👁 Preview</button>
          <button onClick={() => save()} style={{ background:'var(--bg3)', border:'1px solid var(--green)', color:'var(--green)', borderRadius:7, padding:'7px 14px', fontSize:12, fontWeight:700, cursor:'pointer', fontFamily:'inherit' }}>Save</button>
          <button onClick={() => publish()} style={{ background:'var(--green)', color:'#000', border:'none', borderRadius:7, padding:'7px 16px', fontSize:12, fontWeight:900, cursor:'pointer', fontFamily:'inherit' }}>
            {editing.status === 'published' ? '✓ Update' : '🚀 Publish'}
          </button>
        </div>
      </div>

      {}
      <div className={`settings-panel${settingsOpen ? ' open' : ''}`} style={{ marginBottom: settingsOpen ? 14 : 0 }}>
        <SettingsPanel editing={editing} updateField={updateField} inp={inp} card={card} mobile categories={categories} />
      </div>

      <div className="editor-grid">
        {}
        <div>
          <div style={card}>
            <div style={{ marginBottom:14 }}>
              <label style={{ display:'block', fontSize:11, fontWeight:700, color:'var(--muted)', marginBottom:5, textTransform:'uppercase' as const, letterSpacing:'0.8px' }}>Title</label>
              <input className="blog-input" value={editing.title} onChange={e => updateField('title', e.target.value)} placeholder="Enter post title..." style={{ ...inp({ fontSize:'clamp(15px,3vw,20px)', fontWeight:800, padding:'12px 14px' }) }} />
            </div>
            <div>
              <label style={{ display:'block', fontSize:11, fontWeight:700, color:'var(--muted)', marginBottom:5, textTransform:'uppercase' as const, letterSpacing:'0.8px' }}>Slug</label>
              <input className="blog-input" value={editing.slug} onChange={e => updateField('slug', e.target.value)} placeholder="url-slug" style={inp({ fontFamily:'monospace', fontSize:12 })} />
            </div>
          </div>

          <div style={card}>
            <label style={{ display:'block', fontSize:11, fontWeight:700, color:'var(--muted)', marginBottom:8, textTransform:'uppercase' as const, letterSpacing:'0.8px' }}>Excerpt / Summary</label>
            <textarea className="blog-input" value={editing.excerpt} onChange={e => updateField('excerpt', e.target.value)} rows={3} placeholder="Short summary shown in blog listings..." style={{ ...inp({ resize:'vertical', lineHeight:1.7 }) }} />
          </div>

          <div style={card}>
            <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:10, flexWrap:'wrap' as const, gap:8 }}>
              <label style={{ fontSize:11, fontWeight:700, color:'var(--muted)', textTransform:'uppercase' as const, letterSpacing:'0.8px' }}>Body (Markdown supported)</label>
              <span style={{ fontSize:11, color:'var(--dim)' }}>{(editing.body||editing.content||'').length} chars · ~{Math.ceil((editing.body||editing.content||'').split(' ').length / 200)} min</span>
            </div>
            <textarea
              className="blog-input"
              value={editing.body || editing.content || ''}
              onChange={e => updateField('body', e.target.value)}
              rows={20}
              placeholder={'Write your post content here...\n\nUse ## for headings, **bold**, *italic*\n\nTip: Write at least 600 words for SEO.'}
              style={{ ...inp({ resize:'vertical', lineHeight:1.85, fontFamily:'monospace', fontSize:13 }) }}
            />
          </div>
        </div>

        {}
        <div className="editor-sidebar settings-panel" style={{ display:'block' }}>
          <SettingsPanel editing={editing} updateField={updateField} inp={inp} card={card} categories={categories} />
        </div>
      </div>
    </div>
  )

  
  if (view === 'preview' && editing) return (
    <div style={{ maxWidth: 760 }}>
      <div style={{ display:'flex', gap:8, marginBottom:28, flexWrap:'wrap' as const }}>
        <button onClick={() => setView('list')} style={{ background:'var(--bg3)', border:'1px solid var(--border)', color:'var(--muted)', borderRadius:7, padding:'7px 14px', fontSize:12, cursor:'pointer', fontFamily:'inherit' }}>← All Posts</button>
        <button onClick={() => setView('editor')} style={{ background:'var(--green)', color:'#000', border:'none', borderRadius:7, padding:'7px 16px', fontSize:12, fontWeight:700, cursor:'pointer', fontFamily:'inherit' }}>✏️ Edit</button>
      </div>

      <div style={{ background:'var(--bg3)', border:'1px solid var(--border)', borderRadius:14, padding:'clamp(24px,5vw,48px) clamp(20px,5vw,48px)' }}>
        <div style={{ display:'flex', gap:8, marginBottom:20, flexWrap:'wrap' as const }}>
          <span style={{ background:'rgba(0,200,83,0.12)', color:'var(--green)', fontSize:11, fontWeight:700, padding:'3px 10px', borderRadius:20 }}>{editing.category}</span>
          <span style={{ color:'var(--dim)', fontSize:12 }}>{editing.date} · {editing.readTime} min read</span>
          <span style={{ background: editing.status==='published' ? 'rgba(0,200,83,0.1)' : 'rgba(240,165,0,0.1)', color: editing.status==='published' ? 'var(--green)' : 'var(--amber)', fontSize:10, fontWeight:700, padding:'3px 9px', borderRadius:20, marginLeft:'auto' }}>{editing.status.toUpperCase()}</span>
        </div>
        <h1 style={{ fontSize:'clamp(22px,4vw,32px)', fontWeight:900, marginBottom:14, lineHeight:1.2, letterSpacing:'-0.5px', color:'var(--text)' }}>{editing.title || '(No title)'}</h1>
        <p style={{ fontSize:'clamp(14px,2vw,16px)', color:'var(--muted)', marginBottom:28, lineHeight:1.7, borderBottom:'1px solid var(--border)', paddingBottom:24 }}>{editing.excerpt}</p>
        <div style={{ fontSize:'clamp(14px,2vw,15px)', color:'var(--text2)', lineHeight:1.9 }}>
          {(editing.body || editing.content || '').split('\n\n').map((para, i) => {
            if (para.startsWith('## ')) return <h2 key={i} style={{ fontSize:'clamp(17px,3vw,20px)', fontWeight:800, margin:'24px 0 12px', color:'var(--text)' }}>{para.slice(3)}</h2>
            if (para.startsWith('# '))  return <h1 key={i} style={{ fontSize:'clamp(20px,4vw,26px)', fontWeight:900, margin:'28px 0 14px', color:'var(--text)' }}>{para.slice(2)}</h1>
            return <p key={i} style={{ marginBottom:16 }}>{para}</p>
          })}
        </div>
        {editing.tags.length > 0 && (
          <div style={{ marginTop:32, paddingTop:20, borderTop:'1px solid var(--border)', display:'flex', gap:6, flexWrap:'wrap' as const }}>
            {editing.tags.map(t => <span key={t} style={{ background:'var(--bg4)', color:'var(--muted)', fontSize:12, padding:'4px 10px', borderRadius:20 }}>#{t}</span>)}
          </div>
        )}
        <div style={{ marginTop:24, paddingTop:16, borderTop:'1px solid var(--border)', display:'flex', alignItems:'center', gap:10 }}>
          <div style={{ width:36, height:36, borderRadius:'50%', background:'rgba(0,200,83,0.12)', display:'flex', alignItems:'center', justifyContent:'center', fontWeight:900, color:'var(--green)', fontSize:15, flexShrink:0 }}>
            {editing.author.charAt(0)}
          </div>
          <div>
            <div style={{ fontSize:13, fontWeight:700, color:'var(--text)' }}>{editing.author}</div>
            <div style={{ fontSize:11, color:'var(--dim)' }}>TrueOdds Staff</div>
          </div>
        </div>
      </div>
    </div>
  )

  return null
}

function SettingsPanel({ editing, updateField, inp, card, mobile = false, categories }: {
  editing: Post; updateField: (k: keyof Post, v: any) => void
  inp: (extra?: any) => React.CSSProperties; card: React.CSSProperties; mobile?: boolean
  categories: string[]
}) {
  return (
    <>
      <div style={{ ...card, ...(mobile ? { marginBottom: 0 } : {}) }}>
        <div style={{ fontSize:13, fontWeight:800, marginBottom:14 }}>Post Settings</div>

        <div style={{ marginBottom:12 }}>
          <label style={{ display:'block', fontSize:11, fontWeight:700, color:'var(--muted)', marginBottom:5 }}>STATUS</label>
          <div style={{ display:'flex', gap:6 }}>
            {(['draft','published'] as const).map(s => (
              <button key={s} onClick={() => updateField('status', s)} style={{ flex:1, padding:'7px', borderRadius:7, border:`1px solid ${editing.status===s ? 'var(--green)' : 'var(--border)'}`, background: editing.status===s ? 'rgba(0,200,83,0.1)' : 'transparent', color: editing.status===s ? 'var(--green)' : 'var(--muted)', fontSize:12, fontWeight:700, cursor:'pointer', fontFamily:'inherit', textTransform:'capitalize' as const }}>{s}</button>
            ))}
          </div>
        </div>

        {[
          { label:'CATEGORY', type:'select' as const, key:'category' as keyof Post },
          { label:'AUTHOR', type:'text' as const, key:'author' as keyof Post },
          { label:'DATE', type:'date' as const, key:'date' as keyof Post },
          { label:'READ TIME (MIN)', type:'number' as const, key:'readTime' as keyof Post },
        ].map(f => (
          <div key={f.label} style={{ marginBottom:12 }}>
            <label style={{ display:'block', fontSize:11, fontWeight:700, color:'var(--muted)', marginBottom:5 }}>{f.label}</label>
            {f.type === 'select' ? (
              <select value={editing[f.key] as string} onChange={e => updateField(f.key, e.target.value)} style={inp({ cursor:'pointer' })}>
                {categories.map(c => <option key={c}>{c}</option>)}
              </select>
            ) : (
              <input type={f.type} value={editing[f.key] as string} min={f.type==='number'?1:undefined} max={f.type==='number'?60:undefined}
                onChange={e => updateField(f.key, f.type==='number' ? +e.target.value : e.target.value)} style={inp()} />
            )}
          </div>
        ))}

        <div>
          <label style={{ display:'block', fontSize:11, fontWeight:700, color:'var(--muted)', marginBottom:5 }}>TAGS (comma separated)</label>
          <input
            defaultValue={editing.tags.join(', ')}
            key={editing._id || editing.id || 'new'}
            onBlur={e => updateField('tags', e.target.value.split(',').map((t:string) => t.trim()).filter(Boolean))}
            onKeyDown={e => { if (e.key === 'Enter') { updateField('tags', (e.target as HTMLInputElement).value.split(',').map((t:string) => t.trim()).filter(Boolean)); (e.target as HTMLInputElement).blur() } }}
            placeholder="arbitrage, strategy, ev"
            style={inp()}
          />
          <div style={{ display:'flex', gap:4, flexWrap:'wrap' as const, marginTop:6 }}>
            {editing.tags.map(t => <span key={t} style={{ background:'var(--bg4)', color:'var(--dim)', fontSize:10, padding:'2px 8px', borderRadius:20 }}>#{t}</span>)}
          </div>
        </div>
      </div>

      {!mobile && (
        <div style={{ ...card, background:'rgba(0,200,83,0.04)', border:'1px solid rgba(0,200,83,0.15)' }}>
          <div style={{ fontSize:12, fontWeight:700, color:'var(--green)', marginBottom:10 }}>📝 Writing Tips</div>
          {['Start with a hook sentence','Use ## headings to break up text','Aim for 600–1500 words for SEO','Include a real example with numbers','End with a clear call to action'].map(t => (
            <div key={t} style={{ fontSize:12, color:'var(--muted)', marginBottom:6, display:'flex', gap:6 }}>
              <span style={{ color:'var(--green)', flexShrink:0 }}>·</span>{t}
            </div>
          ))}
        </div>
      )}
    </>
  )
}
