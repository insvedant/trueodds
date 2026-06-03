'use client'
import { useState, useEffect } from 'react'
import Link from 'next/link'
import { PublicNavbar, PublicFooter } from '@/components/PublicLayout'
import axios from 'axios'

const API = (process.env.NEXT_PUBLIC_API_URL || 'https://trueodds.onrender.com') + '/api'
const PER_PAGE = 6

type Post = {
  _id: string; title: string; slug: string; excerpt: string
  category: string; emoji: string; tags: string[]
  readTime: number; author: string; createdAt: string
}

const CAT_COLOR: Record<string, { color: string; bg: string }> = {
  Guide:          { color:'#58a6ff', bg:'rgba(88,166,255,0.12)' },
  Strategy:       { color:'#00C853', bg:'rgba(0,200,83,0.12)' },
  Analysis:       { color:'#8957e5', bg:'rgba(137,87,229,0.12)' },
  Tips:           { color:'#f0a500', bg:'rgba(240,165,0,0.12)' },
  News:           { color:'#e53935', bg:'rgba(229,57,53,0.12)' },
  'Tool Updates': { color:'#00bcd4', bg:'rgba(0,188,212,0.12)' },
}

function catStyle(cat: string) {
  return CAT_COLOR[cat] || { color:'#6b7280', bg:'rgba(107,114,128,0.1)' }
}

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString('en-US', { month:'short', day:'numeric', year:'numeric' })
}

function CategoryBadge({ cat }: { cat: string }) {
  const s = catStyle(cat)
  return <span style={{ background:s.bg, color:s.color, fontSize:11, fontWeight:700, padding:'3px 10px', borderRadius:20, flexShrink:0 }}>{cat}</span>
}

export default function BlogPage() {
  const [posts, setPosts]     = useState<Post[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError]     = useState('')
  const [cat, setCat]         = useState('All')
  const [search, setSearch]   = useState('')
  const [page, setPage]       = useState(1)

  useEffect(() => {
    axios.get(`${API}/blog`)
      .then(r => setPosts(Array.isArray(r.data?.data) ? r.data.data : []))
      .catch(() => setError('Could not load articles. Please try again.'))
      .finally(() => setLoading(false))
  }, [])

  // Reset to page 1 whenever filter/search changes
  useEffect(() => { setPage(1) }, [cat, search])

  const categories = ['All', ...Array.from(new Set(posts.map((p: Post) => p.category)))]

  const filtered = posts.filter(p =>
    (cat === 'All' || p.category === cat) &&
    (p.title.toLowerCase().includes(search.toLowerCase()) ||
     p.excerpt.toLowerCase().includes(search.toLowerCase()))
  )

  // Featured = first post only on page 1 with no filters
  const featured   = page === 1 && !search && cat === 'All' ? filtered[0] : undefined
  const rest       = featured ? filtered.slice(1) : filtered
  const totalPages = Math.max(1, Math.ceil(rest.length / PER_PAGE))
  const gridPosts  = rest.slice((page - 1) * PER_PAGE, page * PER_PAGE)

  return (
    <div style={{ background:'var(--bg)', color:'var(--text)', minHeight:'100vh' }}>
      <style>{`
        @keyframes spin { to { transform: rotate(360deg) } }
        .blog-card { transition: transform 0.2s, box-shadow 0.2s; }
        .blog-card:hover { transform: translateY(-3px); box-shadow: 0 12px 36px rgba(0,0,0,0.25); }
        @media (max-width: 768px) {
          .blog-hero    { padding: 40px 16px 32px !important; }
          .blog-hero h1 { font-size: 28px !important; }
          .blog-main    { padding: 24px 16px !important; }
          .blog-grid    { grid-template-columns: 1fr !important; }
          .blog-featured article { grid-template-columns: 1fr !important; }
          .blog-featured-img    { display: none !important; }
          .blog-cats { flex-wrap: nowrap !important; overflow-x: auto !important; scrollbar-width: none !important; }
          .blog-cats::-webkit-scrollbar { display: none; }
        }
      `}</style>

      <PublicNavbar />

      {/* Hero */}
      <section className="blog-hero" style={{ padding:'72px 24px 52px', textAlign:'center', background:'linear-gradient(180deg,rgba(0,200,83,0.04) 0%,transparent 100%)', borderBottom:'1px solid var(--border)' }}>
        <div style={{ maxWidth:620, margin:'0 auto' }}>
          <span style={{ display:'inline-block', background:'rgba(0,200,83,0.08)', border:'1px solid rgba(0,200,83,0.2)', borderRadius:20, padding:'5px 18px', fontSize:12, color:'#00C853', fontWeight:700, marginBottom:20 }}>
            📚 Betting Strategy & Guides
          </span>
          <h1 style={{ fontSize:'clamp(28px,6vw,52px)', fontWeight:900, letterSpacing:'-2px', marginBottom:16, lineHeight:1.08 }}>
            Blog & <span style={{ color:'#00C853' }}>Guides</span>
          </h1>
          <p style={{ color:'var(--muted)', fontSize:16, marginBottom:28, lineHeight:1.7 }}>
            Learn arbitrage, +EV betting, bankroll management, and everything you need to bet like a professional.
          </p>
          <div style={{ position:'relative', maxWidth:440, margin:'0 auto' }}>
            <span style={{ position:'absolute', left:16, top:'50%', transform:'translateY(-50%)', color:'var(--dim)', fontSize:15 }}>🔍</span>
            <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search articles..."
              style={{ width:'100%', background:'var(--bg3)', border:'1px solid var(--border)', borderRadius:28, padding:'12px 20px 12px 44px', fontSize:14, color:'var(--text)', outline:'none', fontFamily:'inherit', boxSizing:'border-box' as const }}
              onFocus={e => (e.target.style.borderColor = '#00C853')}
              onBlur={e  => (e.target.style.borderColor = 'var(--border)')} />
          </div>
        </div>
      </section>

      <div className="blog-main" style={{ maxWidth:1040, margin:'0 auto', padding:'36px 24px' }}>

        {/* Category pills */}
        <div className="blog-cats" style={{ display:'flex', gap:8, marginBottom:32, alignItems:'center' }}>
          {categories.map(c => {
            const active = cat === c
            const s = c === 'All' ? null : catStyle(c)
            return (
              <button key={c} onClick={() => setCat(c)}
                style={{ padding:'7px 20px', borderRadius:24, fontSize:12, fontWeight:700, cursor:'pointer', fontFamily:'inherit', transition:'all 0.15s', whiteSpace:'nowrap' as const, flexShrink:0, border:`1.5px solid ${active ? (s?.color||'#00C853') : 'var(--border)'}`, background:active ? (s ? s.bg : 'rgba(0,200,83,0.1)') : 'var(--bg3)', color:active ? (s?.color||'#00C853') : 'var(--muted)' }}>
                {c}
              </button>
            )
          })}
          <span style={{ marginLeft:'auto', fontSize:12, color:'var(--dim)', flexShrink:0 }}>
            {filtered.length} article{filtered.length !== 1 ? 's' : ''}
          </span>
        </div>

        {/* Loading */}
        {loading && (
          <div style={{ textAlign:'center', padding:80 }}>
            <div style={{ width:36, height:36, border:'3px solid var(--border)', borderTopColor:'#00C853', borderRadius:'50%', animation:'spin 0.8s linear infinite', margin:'0 auto 16px' }} />
            <div style={{ color:'var(--dim)', fontSize:13 }}>Loading articles...</div>
          </div>
        )}

        {/* Error */}
        {error && <div style={{ textAlign:'center', padding:60, color:'var(--dim)' }}>⚠️ {error}</div>}

        {/* Featured */}
        {!loading && !error && featured && (
          <div className="blog-featured" style={{ marginBottom:28 }}>
            <Link href={`/blog/${featured.slug}`} style={{ textDecoration:'none' }}>
              <article className="blog-card" style={{ display:'grid', gridTemplateColumns:'1fr 1fr', background:'var(--bg3)', border:'1px solid var(--border)', borderRadius:20, overflow:'hidden' }}>
                <div style={{ padding:'36px 32px', display:'flex', flexDirection:'column' as const, justifyContent:'space-between' }}>
                  <div>
                    <div style={{ display:'flex', gap:8, marginBottom:16, alignItems:'center', flexWrap:'wrap' as const }}>
                      <span style={{ background:'rgba(0,200,83,0.12)', color:'#00C853', fontSize:10, fontWeight:900, padding:'3px 12px', borderRadius:20 }}>⭐ FEATURED</span>
                      <CategoryBadge cat={featured.category} />
                    </div>
                    <h2 style={{ fontSize:'clamp(18px,2.5vw,28px)', fontWeight:900, marginBottom:14, lineHeight:1.2, color:'var(--text)', letterSpacing:'-0.5px' }}>{featured.title}</h2>
                    <p style={{ color:'var(--muted)', fontSize:15, lineHeight:1.75 }}>{featured.excerpt}</p>
                  </div>
                  <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginTop:24, flexWrap:'wrap' as const, gap:8 }}>
                    <div style={{ display:'flex', gap:6, flexWrap:'wrap' as const }}>
                      {(featured.tags||[]).slice(0,3).map(t => <span key={t} style={{ fontSize:10, color:'var(--dim)', background:'var(--bg4)', padding:'2px 8px', borderRadius:20 }}>#{t}</span>)}
                    </div>
                    <div style={{ display:'flex', alignItems:'center', gap:12, fontSize:12, color:'var(--dim)' }}>
                      <span>{formatDate(featured.createdAt)}</span>
                      <span>{featured.readTime} min read</span>
                      <span style={{ color:'#00C853', fontWeight:700 }}>Read →</span>
                    </div>
                  </div>
                </div>
                <div className="blog-featured-img" style={{ background:`linear-gradient(135deg,${catStyle(featured.category).bg} 0%,rgba(0,0,0,0.15) 100%)`, display:'flex', alignItems:'center', justifyContent:'center', minHeight:260 }}>
                  <span style={{ fontSize:96, opacity:0.5 }}>{featured.emoji}</span>
                </div>
              </article>
            </Link>
          </div>
        )}

        {/* Grid */}
        {!loading && !error && gridPosts.length > 0 && (
          <div className="blog-grid" style={{ display:'grid', gridTemplateColumns:'repeat(auto-fill,minmax(300px,1fr))', gap:20, marginBottom:40 }}>
            {gridPosts.map(post => {
              const s = catStyle(post.category)
              return (
                <Link key={post._id} href={`/blog/${post.slug}`} style={{ textDecoration:'none', display:'block', height:'100%' }}>
                  <article className="blog-card" style={{ height:'100%', background:'var(--bg3)', border:'1px solid var(--border)', borderRadius:16, overflow:'hidden', display:'flex', flexDirection:'column' as const }}>
                    <div style={{ height:140, background:`linear-gradient(135deg,${s.bg} 0%,rgba(0,0,0,0.15) 100%)`, display:'flex', alignItems:'center', justifyContent:'center', position:'relative' as const, flexShrink:0 }}>
                      <span style={{ fontSize:52, opacity:0.65 }}>{post.emoji}</span>
                      <div style={{ position:'absolute', top:12, left:14 }}><CategoryBadge cat={post.category} /></div>
                    </div>
                    <div style={{ padding:'18px 20px', flex:1, display:'flex', flexDirection:'column' as const }}>
                      <h3 style={{ fontSize:16, fontWeight:800, marginBottom:8, lineHeight:1.3, color:'var(--text)' }}>{post.title}</h3>
                      <p style={{ color:'var(--muted)', fontSize:13, lineHeight:1.7, flex:1 }}>{post.excerpt}</p>
                      <div style={{ display:'flex', gap:5, flexWrap:'wrap' as const, marginTop:12 }}>
                        {(post.tags||[]).slice(0,2).map(t => <span key={t} style={{ fontSize:10, color:'var(--dim)', background:'var(--bg4)', padding:'2px 8px', borderRadius:20 }}>#{t}</span>)}
                      </div>
                    </div>
                    <div style={{ borderTop:'1px solid var(--border)', padding:'11px 20px', display:'flex', justifyContent:'space-between', alignItems:'center', background:'rgba(0,0,0,0.12)' }}>
                      <span style={{ fontSize:11, color:'var(--dim)' }}>{formatDate(post.createdAt)} · {post.readTime} min</span>
                      <span style={{ fontSize:11, fontWeight:700, color:s.color }}>Read →</span>
                    </div>
                  </article>
                </Link>
              )
            })}
          </div>
        )}

        {/* Empty */}
        {!loading && !error && filtered.length === 0 && (
          <div style={{ textAlign:'center', padding:'80px 20px' }}>
            <div style={{ fontSize:48, marginBottom:16 }}>🔍</div>
            <div style={{ fontSize:18, fontWeight:700, marginBottom:8 }}>No articles found</div>
            <div style={{ fontSize:14, color:'var(--dim)' }}>Try a different search or category</div>
          </div>
        )}

        {/* Pagination */}
        {!loading && !error && totalPages > 1 && (
          <div style={{ display:'flex', justifyContent:'center', alignItems:'center', gap:6, marginBottom:48 }}>
            <button onClick={() => setPage(p => Math.max(1, p-1))} disabled={page===1}
              style={{ padding:'8px 20px', borderRadius:24, fontSize:13, fontWeight:600, border:'1.5px solid var(--border)', background:'var(--bg3)', color:page===1?'var(--dim)':'var(--text)', cursor:page===1?'not-allowed':'pointer', fontFamily:'inherit', opacity:page===1?0.4:1, transition:'all 0.15s' }}>
              ← Prev
            </button>
            {Array.from({ length: totalPages }, (_, i) => i + 1).map(n => (
              <button key={n} onClick={() => setPage(n)}
                style={{ width:38, height:38, borderRadius:'50%', fontSize:13, fontWeight:700, border:`1.5px solid ${page===n?'#00C853':'var(--border)'}`, background:page===n?'rgba(0,200,83,0.12)':'var(--bg3)', color:page===n?'#00C853':'var(--muted)', cursor:'pointer', fontFamily:'inherit', transition:'all 0.15s', flexShrink:0 }}>
                {n}
              </button>
            ))}
            <button onClick={() => setPage(p => Math.min(totalPages, p+1))} disabled={page===totalPages}
              style={{ padding:'8px 20px', borderRadius:24, fontSize:13, fontWeight:600, border:'1.5px solid var(--border)', background:'var(--bg3)', color:page===totalPages?'var(--dim)':'var(--text)', cursor:page===totalPages?'not-allowed':'pointer', fontFamily:'inherit', opacity:page===totalPages?0.4:1, transition:'all 0.15s' }}>
              Next →
            </button>
          </div>
        )}

      </div>

      <PublicFooter />
    </div>
  )
}
