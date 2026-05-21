'use client'
import { useState } from 'react'

type Post = {
  id: string; title: string; slug: string; category: string
  status: 'draft' | 'published'; excerpt: string; body: string
  author: string; date: string; readTime: number; tags: string[]
}

const CATEGORIES = ['Strategy', 'Guide', 'News', 'Analysis', 'Tips', 'Tool Updates']

const INITIAL_POSTS: Post[] = [
  { id:'1', title:'What is Arbitrage Betting?', slug:'what-is-arbitrage-betting', category:'Guide', status:'published', excerpt:'Arbitrage betting lets you guarantee profit by backing all outcomes at different sportsbooks.', body:'Arbitrage betting (also called "arbing" or "sure betting") is a strategy where you place bets on all possible outcomes of an event across different sportsbooks that have priced the odds in a way that guarantees a profit regardless of the result.\n\nThe key is finding situations where sportsbooks disagree on the probability of an outcome. When Book A gives Team X odds of +150 and Book B gives Team Y odds of +130, there may be an opportunity where backing both sides costs less than the guaranteed return.\n\n## How to calculate an arb\n\nConvert American odds to decimal, then sum the inverse probabilities. If the sum is less than 1.0, you have an arb. The profit percentage is (1 - sum) × 100.\n\n## Real example\n\nDraftKings offers Minnesota Wild at +322 (decimal: 4.22) and FanDuel offers Colorado Avalanche at -280 (decimal: 1.357). Sum of implied probs = 1/4.22 + 1/1.357 = 0.237 + 0.737 = 0.974. That\'s less than 1.0, so you have a +2.6% arb!', author:'TrueOdds Team', date:'2024-01-10', readTime:6, tags:['arbitrage','beginners','strategy'] },
  { id:'2', title:'Positive EV Betting Explained', slug:'positive-ev-betting-explained', category:'Strategy', status:'published', excerpt:'Expected value betting is the most sustainable long-term sports betting strategy.', body:'Positive Expected Value (+EV) betting means placing bets where the price offered by a sportsbook is higher than the true probability of the outcome. Over time, this builds a mathematical edge.\n\n## The formula\n\nEV = (True probability × Decimal odds) − 1\n\nIf a sportsbook offers +145 on a bet that has a true probability of 45%, then:\nDecimal odds = 2.45\nEV = 0.45 × 2.45 − 1 = 0.1025 = +10.25%\n\nThis means for every $100 you bet, you expect to gain $10.25 on average over a large sample.', author:'TrueOdds Team', date:'2024-01-05', readTime:8, tags:['expected value','strategy','kelly criterion'] },
  { id:'3', title:'Best Sportsbooks for Arb Betting 2024', slug:'best-sportsbooks-arb-2024', category:'Analysis', status:'draft', excerpt:'Not all sportsbooks are equal for arb bettors. Here are the ones with the most generous limits.', body:'When arbitrage betting, your choice of sportsbooks matters enormously. You need books with:\n\n1. High bet limits before accounts get restricted\n2. Fast line updates (so you can act before they close)\n3. Easy deposit/withdrawal\n4. Soft pricing relative to sharp books\n\n## Top picks for 2024\n\n**Pinnacle** — The sharpest book in the world. Use as your reference for true odds.\n**DraftKings** — High limits, US-friendly, slow to restrict\n**FanDuel** — Similar to DraftKings, great for parlays and same-game parlays', author:'TrueOdds Team', date:'2024-01-15', readTime:10, tags:['sportsbooks','arbitrage','review'] },
]

function slugify(str: string) {
  return str.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '')
}

const inp = (extra = {}) => ({
  background: 'var(--bg2)',
  border: '1px solid var(--border)',
  borderRadius: 8,
  padding: '9px 12px',
  color: 'var(--text)',
  fontSize: 13,
  outline: 'none',
  fontFamily: 'inherit',
  width: '100%',
  transition: 'border-color 0.15s',
  ...extra,
} as React.CSSProperties)

export default function AdminBlogPage() {
  const [posts, setPosts] = useState<Post[]>(INITIAL_POSTS)
  const [view, setView] = useState<'list' | 'editor' | 'preview'>('list')
  const [editing, setEditing] = useState<Post | null>(null)
  const [filter, setFilter] = useState<'all' | 'published' | 'draft'>('all')
  const [search, setSearch] = useState('')
  const [saved, setSaved] = useState(false)

  const filtered = posts.filter(p =>
    (filter === 'all' || p.status === filter) &&
    (p.title.toLowerCase().includes(search.toLowerCase()) || p.category.toLowerCase().includes(search.toLowerCase()))
  )

  const newPost = (): Post => ({
    id: Date.now().toString(), title: '', slug: '', category: 'Strategy',
    status: 'draft', excerpt: '', body: '', author: 'TrueOdds Team',
    date: new Date().toISOString().split('T')[0], readTime: 5, tags: [],
  })

  const openEditor = (post: Post) => { setEditing({ ...post }); setView('editor'); setSaved(false) }
  const openNew    = () => { setEditing(newPost()); setView('editor'); setSaved(false) }

  const updateField = (key: keyof Post, val: any) => {
    if (!editing) return
    const updated = { ...editing, [key]: val }
    if (key === 'title') updated.slug = slugify(val)
    setEditing(updated)
    setSaved(false)
  }

  const save = () => {
    if (!editing) return
    setPosts(prev => {
      const exists = prev.find(p => p.id === editing.id)
      return exists ? prev.map(p => p.id === editing.id ? editing : p) : [editing, ...prev]
    })
    setSaved(true)
  }

  const publish = () => {
    if (!editing) return
    const updated = { ...editing, status: 'published' as const }
    setEditing(updated)
    setPosts(prev => {
      const exists = prev.find(p => p.id === updated.id)
      return exists ? prev.map(p => p.id === updated.id ? updated : p) : [updated, ...prev]
    })
    setSaved(true)
  }

  const deletePost = (id: string) => {
    if (!confirm('Delete this post permanently?')) return
    setPosts(prev => prev.filter(p => p.id !== id))
    if (editing?.id === id) { setEditing(null); setView('list') }
  }

  const card: React.CSSProperties = { background: 'var(--bg3)', border: '1px solid var(--border)', borderRadius: 12, padding: 20, marginBottom: 14 }

  /* ── LIST VIEW ── */
  if (view === 'list') return (
    <div style={{ maxWidth: 1000 }}>
      <div style={{ display:'flex', alignItems:'flex-start', justifyContent:'space-between', marginBottom:24, flexWrap:'wrap', gap:12 }}>
        <div>
          <h1 style={{ fontSize:22, fontWeight:900, marginBottom:4 }}>✍️ Blog Manager</h1>
          <p style={{ color:'var(--muted)', fontSize:13 }}>{posts.filter(p=>p.status==='published').length} published · {posts.filter(p=>p.status==='draft').length} drafts</p>
        </div>
        <button onClick={openNew} style={{ background:'var(--green)', color:'#fff', border:'none', borderRadius:9, padding:'10px 22px', fontSize:14, fontWeight:800, cursor:'pointer', fontFamily:'inherit' }}>
          + New Post
        </button>
      </div>

      {/* Filters */}
      <div style={{ display:'flex', gap:8, marginBottom:16, flexWrap:'wrap', alignItems:'center' }}>
        {(['all','published','draft'] as const).map(f => (
          <button key={f} onClick={() => setFilter(f)} style={{ padding:'6px 16px', borderRadius:20, fontSize:12, fontWeight:700, cursor:'pointer', fontFamily:'inherit', border:'none', background: filter===f ? 'var(--green)' : 'var(--bg3)', color: filter===f ? '#fff' : 'var(--muted)', textTransform:'capitalize' }}>{f}</button>
        ))}
        <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search posts..." style={{ ...inp(), width:200 }} />
        <span style={{ marginLeft:'auto', fontSize:12, color:'var(--muted)' }}>{filtered.length} posts</span>
      </div>

      {/* Posts list */}
      {filtered.map(post => (
        <div key={post.id} style={{ ...card, display:'flex', alignItems:'flex-start', justifyContent:'space-between', gap:16 }}>
          <div style={{ flex:1, minWidth:0 }}>
            <div style={{ display:'flex', alignItems:'center', gap:8, marginBottom:8, flexWrap:'wrap' }}>
              <span style={{ background: post.status==='published' ? 'rgba(0,200,83,0.12)' : 'rgba(240,165,0,0.1)', color: post.status==='published' ? 'var(--green)' : 'var(--amber)', fontSize:10, fontWeight:800, padding:'2px 8px', borderRadius:20, textTransform:'uppercase' }}>{post.status}</span>
              <span style={{ background:'var(--bg4)', color:'var(--muted)', fontSize:10, padding:'2px 8px', borderRadius:20 }}>{post.category}</span>
              <span style={{ color:'var(--dim)', fontSize:11 }}>{post.date}</span>
              <span style={{ color:'var(--dim)', fontSize:11 }}>· {post.readTime} min read</span>
            </div>
            <div style={{ fontWeight:800, fontSize:16, marginBottom:6, color:'var(--text)' }}>{post.title || '(Untitled)'}</div>
            <div style={{ fontSize:13, color:'var(--muted)', marginBottom:8, lineHeight:1.6 }}>{post.excerpt}</div>
            <div style={{ display:'flex', gap:6, flexWrap:'wrap' }}>
              {post.tags.map(t => <span key={t} style={{ background:'var(--bg4)', color:'var(--dim)', fontSize:10, padding:'2px 8px', borderRadius:20 }}>#{t}</span>)}
            </div>
          </div>
          <div style={{ display:'flex', flexDirection:'column', gap:6, flexShrink:0 }}>
            <button onClick={() => openEditor(post)} style={{ background:'var(--green)', color:'#fff', border:'none', borderRadius:7, padding:'7px 16px', fontSize:12, fontWeight:700, cursor:'pointer', fontFamily:'inherit' }}>Edit</button>
            <button onClick={() => { openEditor(post); setView('preview') }} style={{ background:'var(--bg4)', color:'var(--text)', border:'1px solid var(--border)', borderRadius:7, padding:'7px 14px', fontSize:12, cursor:'pointer', fontFamily:'inherit' }}>Preview</button>
            <button onClick={() => deletePost(post.id)} style={{ background:'rgba(220,38,38,0.1)', color:'var(--red)', border:'1px solid rgba(220,38,38,0.2)', borderRadius:7, padding:'7px 14px', fontSize:12, cursor:'pointer', fontFamily:'inherit' }}>Delete</button>
          </div>
        </div>
      ))}

      {filtered.length === 0 && (
        <div style={{ textAlign:'center', padding:60, color:'var(--dim)', background:'var(--bg3)', border:'1px solid var(--border)', borderRadius:12 }}>
          No posts found. <button onClick={openNew} style={{ background:'none', border:'none', color:'var(--green)', cursor:'pointer', fontFamily:'inherit', fontWeight:700 }}>Create your first post →</button>
        </div>
      )}
    </div>
  )

  /* ── EDITOR VIEW ── */
  if (view === 'editor' && editing) return (
    <div style={{ maxWidth: 900 }}>
      {/* Editor topbar */}
      <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:20, gap:12, flexWrap:'wrap' }}>
        <div style={{ display:'flex', alignItems:'center', gap:10 }}>
          <button onClick={() => setView('list')} style={{ background:'var(--bg3)', border:'1px solid var(--border)', color:'var(--muted)', borderRadius:7, padding:'6px 14px', fontSize:12, cursor:'pointer', fontFamily:'inherit' }}>← Back</button>
          <div style={{ fontSize:14, fontWeight:700, color:'var(--text)' }}>{editing.id && posts.find(p=>p.id===editing.id) ? 'Editing post' : 'New post'}</div>
          {saved && <span style={{ color:'var(--green)', fontSize:12, fontWeight:600 }}>✓ Saved</span>}
        </div>
        <div style={{ display:'flex', gap:8 }}>
          <button onClick={() => setView('preview')} style={{ background:'var(--bg3)', border:'1px solid var(--border)', color:'var(--text)', borderRadius:7, padding:'7px 16px', fontSize:12, cursor:'pointer', fontFamily:'inherit' }}>👁 Preview</button>
          <button onClick={save} style={{ background:'var(--bg3)', border:'1px solid var(--green)', color:'var(--green)', borderRadius:7, padding:'7px 16px', fontSize:12, fontWeight:700, cursor:'pointer', fontFamily:'inherit' }}>Save Draft</button>
          <button onClick={publish} style={{ background:'var(--green)', color:'#fff', border:'none', borderRadius:7, padding:'7px 18px', fontSize:12, fontWeight:800, cursor:'pointer', fontFamily:'inherit' }}>
            {editing.status === 'published' ? '✓ Update Published' : '🚀 Publish'}
          </button>
        </div>
      </div>

      <div style={{ display:'grid', gridTemplateColumns:'1fr 280px', gap:16 }}>
        {/* Main editor */}
        <div>
          <div style={card}>
            <div style={{ marginBottom:14 }}>
              <label style={{ display:'block', fontSize:11, fontWeight:700, color:'var(--muted)', marginBottom:5, textTransform:'uppercase', letterSpacing:'0.8px' }}>Title</label>
              <input value={editing.title} onChange={e => updateField('title', e.target.value)} placeholder="Enter post title..." style={{ ...inp({ fontSize:20, fontWeight:800, padding:'12px 14px' }) }} />
            </div>
            <div>
              <label style={{ display:'block', fontSize:11, fontWeight:700, color:'var(--muted)', marginBottom:5, textTransform:'uppercase', letterSpacing:'0.8px' }}>Slug</label>
              <input value={editing.slug} onChange={e => updateField('slug', e.target.value)} placeholder="url-slug" style={inp({ fontFamily:'monospace', fontSize:13 })} />
            </div>
          </div>

          <div style={card}>
            <label style={{ display:'block', fontSize:11, fontWeight:700, color:'var(--muted)', marginBottom:8, textTransform:'uppercase', letterSpacing:'0.8px' }}>Excerpt / Summary</label>
            <textarea value={editing.excerpt} onChange={e => updateField('excerpt', e.target.value)} rows={3} placeholder="Short summary shown in blog listings..." style={{ ...inp({ resize:'vertical', lineHeight:1.7 }) }} />
          </div>

          <div style={card}>
            <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:10 }}>
              <label style={{ fontSize:11, fontWeight:700, color:'var(--muted)', textTransform:'uppercase', letterSpacing:'0.8px' }}>Body (Markdown supported)</label>
              <span style={{ fontSize:11, color:'var(--dim)' }}>{editing.body.length} chars · ~{Math.ceil(editing.body.split(' ').length / 200)} min read</span>
            </div>
            <textarea
              value={editing.body}
              onChange={e => updateField('body', e.target.value)}
              rows={22}
              placeholder="Write your post content here...&#10;&#10;Use ## for headings, **bold**, *italic*&#10;&#10;Tip: Write at least 600 words for SEO."
              style={{ ...inp({ resize:'vertical', lineHeight:1.85, fontFamily:'monospace', fontSize:13 }) }}
            />
          </div>
        </div>

        {/* Sidebar */}
        <div>
          <div style={card}>
            <div style={{ fontSize:13, fontWeight:800, marginBottom:14 }}>Post Settings</div>

            <div style={{ marginBottom:12 }}>
              <label style={{ display:'block', fontSize:11, fontWeight:700, color:'var(--muted)', marginBottom:5 }}>STATUS</label>
              <div style={{ display:'flex', gap:6 }}>
                {(['draft','published'] as const).map(s => (
                  <button key={s} onClick={() => updateField('status', s)} style={{ flex:1, padding:'6px', borderRadius:7, border:`1px solid ${editing.status===s ? 'var(--green)' : 'var(--border)'}`, background: editing.status===s ? 'rgba(0,200,83,0.1)' : 'transparent', color: editing.status===s ? 'var(--green)' : 'var(--muted)', fontSize:11, fontWeight:700, cursor:'pointer', fontFamily:'inherit', textTransform:'capitalize' }}>{s}</button>
                ))}
              </div>
            </div>

            <div style={{ marginBottom:12 }}>
              <label style={{ display:'block', fontSize:11, fontWeight:700, color:'var(--muted)', marginBottom:5 }}>CATEGORY</label>
              <select value={editing.category} onChange={e => updateField('category', e.target.value)} style={inp({ cursor:'pointer' })}>
                {CATEGORIES.map(c => <option key={c}>{c}</option>)}
              </select>
            </div>

            <div style={{ marginBottom:12 }}>
              <label style={{ display:'block', fontSize:11, fontWeight:700, color:'var(--muted)', marginBottom:5 }}>AUTHOR</label>
              <input value={editing.author} onChange={e => updateField('author', e.target.value)} style={inp()} />
            </div>

            <div style={{ marginBottom:12 }}>
              <label style={{ display:'block', fontSize:11, fontWeight:700, color:'var(--muted)', marginBottom:5 }}>DATE</label>
              <input type="date" value={editing.date} onChange={e => updateField('date', e.target.value)} style={inp()} />
            </div>

            <div style={{ marginBottom:12 }}>
              <label style={{ display:'block', fontSize:11, fontWeight:700, color:'var(--muted)', marginBottom:5 }}>READ TIME (MIN)</label>
              <input type="number" value={editing.readTime} min={1} max={60} onChange={e => updateField('readTime', +e.target.value)} style={inp()} />
            </div>

            <div>
              <label style={{ display:'block', fontSize:11, fontWeight:700, color:'var(--muted)', marginBottom:5 }}>TAGS (comma separated)</label>
              <input value={editing.tags.join(', ')} onChange={e => updateField('tags', e.target.value.split(',').map(t => t.trim()).filter(Boolean))} placeholder="arbitrage, strategy, ev" style={inp()} />
              <div style={{ display:'flex', gap:4, flexWrap:'wrap', marginTop:6 }}>
                {editing.tags.map(t => <span key={t} style={{ background:'var(--bg4)', color:'var(--dim)', fontSize:10, padding:'2px 8px', borderRadius:20 }}>#{t}</span>)}
              </div>
            </div>
          </div>

          <div style={{ ...card, background: 'rgba(0,200,83,0.04)', border: '1px solid rgba(0,200,83,0.15)' }}>
            <div style={{ fontSize:12, fontWeight:700, color:'var(--green)', marginBottom:10 }}>📝 Writing Tips</div>
            {['Start with a hook sentence', 'Use ## headings to break up text', 'Aim for 600–1500 words for SEO', 'Include a real example with numbers', 'End with a clear call to action'].map(t => (
              <div key={t} style={{ fontSize:12, color:'var(--muted)', marginBottom:6, display:'flex', gap:6 }}>
                <span style={{ color:'var(--green)', flexShrink:0 }}>·</span>{t}
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  )

  /* ── PREVIEW VIEW ── */
  if (view === 'preview' && editing) return (
    <div style={{ maxWidth: 760 }}>
      <div style={{ display:'flex', gap:8, marginBottom:28 }}>
        <button onClick={() => setView('list')} style={{ background:'var(--bg3)', border:'1px solid var(--border)', color:'var(--muted)', borderRadius:7, padding:'6px 14px', fontSize:12, cursor:'pointer', fontFamily:'inherit' }}>← All Posts</button>
        <button onClick={() => setView('editor')} style={{ background:'var(--green)', color:'#fff', border:'none', borderRadius:7, padding:'6px 16px', fontSize:12, fontWeight:700, cursor:'pointer', fontFamily:'inherit' }}>✏️ Edit</button>
      </div>

      {/* Rendered preview */}
      <div style={{ background:'var(--bg3)', border:'1px solid var(--border)', borderRadius:14, padding:'40px 48px' }}>
        <div style={{ display:'flex', gap:8, marginBottom:20, flexWrap:'wrap' }}>
          <span style={{ background:'rgba(0,200,83,0.12)', color:'var(--green)', fontSize:11, fontWeight:700, padding:'3px 10px', borderRadius:20 }}>{editing.category}</span>
          <span style={{ color:'var(--dim)', fontSize:12 }}>{editing.date}</span>
          <span style={{ color:'var(--dim)', fontSize:12 }}>· {editing.readTime} min read</span>
          <span style={{ background: editing.status==='published' ? 'rgba(0,200,83,0.1)' : 'rgba(240,165,0,0.1)', color: editing.status==='published' ? 'var(--green)' : 'var(--amber)', fontSize:10, fontWeight:700, padding:'3px 9px', borderRadius:20, marginLeft:'auto' }}>{editing.status.toUpperCase()}</span>
        </div>

        <h1 style={{ fontSize:32, fontWeight:900, marginBottom:14, lineHeight:1.2, letterSpacing:'-0.5px', color:'var(--text)' }}>{editing.title || '(No title)'}</h1>
        <p style={{ fontSize:16, color:'var(--muted)', marginBottom:28, lineHeight:1.7, borderBottom:'1px solid var(--border)', paddingBottom:24 }}>{editing.excerpt}</p>

        <div style={{ fontSize:15, color:'var(--text2)', lineHeight:1.9 }}>
          {editing.body.split('\n\n').map((para, i) => {
            if (para.startsWith('## ')) return <h2 key={i} style={{ fontSize:20, fontWeight:800, margin:'24px 0 12px', color:'var(--text)' }}>{para.slice(3)}</h2>
            if (para.startsWith('# '))  return <h1 key={i} style={{ fontSize:26, fontWeight:900, margin:'28px 0 14px', color:'var(--text)' }}>{para.slice(2)}</h1>
            return <p key={i} style={{ marginBottom:16 }}>{para}</p>
          })}
        </div>

        {editing.tags.length > 0 && (
          <div style={{ marginTop:32, paddingTop:20, borderTop:'1px solid var(--border)', display:'flex', gap:6, flexWrap:'wrap' }}>
            {editing.tags.map(t => <span key={t} style={{ background:'var(--bg4)', color:'var(--muted)', fontSize:12, padding:'4px 10px', borderRadius:20 }}>#{t}</span>)}
          </div>
        )}

        <div style={{ marginTop:24, paddingTop:16, borderTop:'1px solid var(--border)', display:'flex', alignItems:'center', gap:10 }}>
          <div style={{ width:36, height:36, borderRadius:'50%', background:'rgba(0,200,83,0.12)', display:'flex', alignItems:'center', justifyContent:'center', fontWeight:900, color:'var(--green)', fontSize:15 }}>
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
