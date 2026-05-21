'use client'
import { useState } from 'react'
import Link from 'next/link'
import { PublicNavbar, PublicFooter } from '@/components/PublicLayout'

const POSTS = [
  { id:'1', title:'What is Arbitrage Betting?',           slug:'what-is-arbitrage-betting',      category:'Guide',    status:'published', excerpt:'Arbitrage betting lets you guarantee profit by backing all outcomes at different sportsbooks — regardless of who wins.', date:'Jan 10, 2024', readTime:6,  tags:['arbitrage','beginners'] },
  { id:'2', title:'Positive EV Betting Explained',         slug:'positive-ev-betting-explained',  category:'Strategy', status:'published', excerpt:'Expected value betting is the most sustainable long-term sports betting strategy. Learn the math behind it.', date:'Jan 5, 2024',  readTime:8,  tags:['expected value','kelly'] },
  { id:'3', title:'Best Sportsbooks for Arb Betting 2024', slug:'best-sportsbooks-arb-2024',      category:'Analysis', status:'published', excerpt:'Not all sportsbooks are equal. Here are the ones with the highest limits, the slowest restrictions, and the softest lines.', date:'Jan 3, 2024',  readTime:10, tags:['sportsbooks','review'] },
  { id:'4', title:'Kelly Criterion: How Much to Bet',      slug:'kelly-criterion-bet-sizing',     category:'Strategy', status:'published', excerpt:'Bet too small and you\'re leaving profit on the table. Bet too large and you go broke. Kelly solves this precisely.', date:'Dec 28, 2023', readTime:7,  tags:['kelly','bankroll'] },
  { id:'5', title:'How to Avoid Sportsbook Restrictions',  slug:'avoid-sportsbook-restrictions',  category:'Tips',     status:'published', excerpt:'Sportsbooks limit winning accounts. Here are the strategies professionals use to stay under the radar and keep their limits.', date:'Dec 20, 2023', readTime:9,  tags:['limits','strategy'] },
  { id:'6', title:'Sharp vs Square: What\'s the Difference?', slug:'sharp-vs-square',            category:'Guide',    status:'published', excerpt:'Sharp bettors win long term. Square bettors lose. Understanding what separates them is the first step to crossing over.', date:'Dec 14, 2023', readTime:5,  tags:['sharp','beginners'] },
]

const CATEGORIES = ['All', 'Guide', 'Strategy', 'Analysis', 'Tips', 'Tool Updates']
const CAT_COLOR: Record<string, string> = { Guide:'var(--blue)', Strategy:'var(--green)', Analysis:'var(--purple)', Tips:'var(--amber)', 'Tool Updates':'var(--red)' }

export default function BlogPage() {
  const [cat, setCat] = useState('All')
  const [search, setSearch] = useState('')

  const filtered = POSTS.filter(p =>
    p.status === 'published' &&
    (cat === 'All' || p.category === cat) &&
    (p.title.toLowerCase().includes(search.toLowerCase()) || p.excerpt.toLowerCase().includes(search.toLowerCase()))
  )

  const S = {
    page: { background:'var(--bg)', color:'var(--text)', minHeight:'100vh' } as React.CSSProperties,
    card: { background:'var(--bg3)', border:'1px solid var(--border)', borderRadius:14, overflow:'hidden' } as React.CSSProperties,
  }

  return (
    <div style={S.page}>
      <PublicNavbar />

      {/* Header */}
      <section style={{ padding:'64px 24px 48px', textAlign:'center', borderBottom:'1px solid var(--border)', background:'var(--bg2)' }}>
        <div style={{ display:'inline-block', background:'rgba(0,200,83,0.08)', border:'1px solid rgba(0,200,83,0.2)', borderRadius:20, padding:'5px 16px', fontSize:12, color:'var(--green)', fontWeight:700, marginBottom:20 }}>Betting Strategy</div>
        <h1 style={{ fontSize:'clamp(30px,5vw,52px)', fontWeight:900, letterSpacing:'-1.5px', marginBottom:14 }}>Blog & Guides</h1>
        <p style={{ color:'var(--muted)', fontSize:15, marginBottom:28, maxWidth:480, margin:'0 auto 28px' }}>Learn arbitrage, +EV betting, bankroll management, and everything you need to bet like a professional.</p>
        <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search articles..." style={{ width:'100%', maxWidth:400, background:'var(--bg3)', border:'1px solid var(--border2)', borderRadius:24, padding:'10px 18px', fontSize:14, color:'var(--text)', outline:'none', fontFamily:'inherit', display:'block', margin:'0 auto' }} />
      </section>

      <div style={{ maxWidth:960, margin:'0 auto', padding:'40px 24px' }}>
        {/* Category pills */}
        <div style={{ display:'flex', gap:8, marginBottom:32, flexWrap:'wrap' }}>
          {CATEGORIES.map(c => (
            <button key={c} onClick={() => setCat(c)} style={{ padding:'6px 18px', borderRadius:24, fontSize:12, fontWeight:700, cursor:'pointer', border:'none', background: cat===c ? 'var(--green)' : 'var(--bg3)', color: cat===c ? '#fff' : 'var(--muted)', fontFamily:'inherit', transition:'all 0.15s' }}>{c}</button>
          ))}
          <span style={{ marginLeft:'auto', fontSize:12, color:'var(--dim)', alignSelf:'center' }}>{filtered.length} articles</span>
        </div>

        {/* Featured post */}
        {filtered.length > 0 && cat === 'All' && !search && (
          <div style={{ ...S.card, marginBottom:24, display:'grid', gridTemplateColumns:'1fr 1fr' }}>
            <div style={{ background:'linear-gradient(135deg, rgba(0,200,83,0.12) 0%, rgba(88,166,255,0.06) 100%)', padding:'36px', display:'flex', flexDirection:'column', justifyContent:'space-between' }}>
              <div>
                <div style={{ background:'rgba(0,200,83,0.12)', color:'var(--green)', fontSize:11, fontWeight:700, padding:'3px 10px', borderRadius:20, display:'inline-block', marginBottom:16 }}>⭐ FEATURED</div>
                <div style={{ fontSize:10, fontWeight:700, color:'var(--dim)', textTransform:'uppercase', letterSpacing:'1px', marginBottom:10 }}>{filtered[0].category}</div>
                <h2 style={{ fontSize:24, fontWeight:900, marginBottom:12, lineHeight:1.25, letterSpacing:'-0.5px', color:'var(--text)' }}>{filtered[0].title}</h2>
                <p style={{ color:'var(--muted)', fontSize:14, lineHeight:1.75 }}>{filtered[0].excerpt}</p>
              </div>
              <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginTop:24 }}>
                <span style={{ color:'var(--dim)', fontSize:12 }}>{filtered[0].date} · {filtered[0].readTime} min</span>
                <Link href={`/blog/${filtered[0].slug}`} style={{ color:'var(--green)', textDecoration:'none', fontSize:13, fontWeight:700 }}>Read →</Link>
              </div>
            </div>
            <div style={{ background:'var(--bg4)', display:'flex', alignItems:'center', justifyContent:'center' }}>
              <div style={{ fontSize:72, opacity:0.4 }}>📊</div>
            </div>
          </div>
        )}

        {/* Grid */}
        <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fill,minmax(280px,1fr))', gap:16 }}>
          {(cat === 'All' && !search ? filtered.slice(1) : filtered).map(post => (
            <div key={post.id} style={S.card}>
              <div style={{ height:130, background:`linear-gradient(135deg, ${CAT_COLOR[post.category] || 'var(--green)'}18, ${CAT_COLOR[post.category] || 'var(--blue)'}08)`, display:'flex', alignItems:'center', justifyContent:'center', fontSize:52, opacity:0.7 }}>
                {post.category === 'Guide' ? '📖' : post.category === 'Strategy' ? '♟️' : post.category === 'Analysis' ? '📊' : post.category === 'Tips' ? '💡' : '🔧'}
              </div>
              <div style={{ padding:'20px' }}>
                <div style={{ display:'flex', gap:6, marginBottom:10, flexWrap:'wrap' }}>
                  <span style={{ color: CAT_COLOR[post.category] || 'var(--green)', fontSize:10, fontWeight:700, textTransform:'uppercase', letterSpacing:'1px' }}>{post.category}</span>
                  <span style={{ color:'var(--dim)', fontSize:11 }}>· {post.readTime} min read</span>
                </div>
                <h3 style={{ fontWeight:800, fontSize:16, marginBottom:8, lineHeight:1.3, color:'var(--text)' }}>{post.title}</h3>
                <p style={{ color:'var(--muted)', fontSize:13, lineHeight:1.7, marginBottom:16 }}>{post.excerpt}</p>
                <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between' }}>
                  <span style={{ color:'var(--dim)', fontSize:11 }}>{post.date}</span>
                  <Link href={`/blog/${post.slug}`} style={{ color:'var(--green)', textDecoration:'none', fontSize:12, fontWeight:700 }}>Read →</Link>
                </div>
              </div>
            </div>
          ))}
        </div>

        {filtered.length === 0 && (
          <div style={{ textAlign:'center', padding:60, color:'var(--dim)', background:'var(--bg3)', border:'1px solid var(--border)', borderRadius:14 }}>
            No articles found. <button onClick={() => { setSearch(''); setCat('All') }} style={{ background:'none', border:'none', color:'var(--green)', cursor:'pointer', fontFamily:'inherit', fontWeight:700 }}>Clear filters →</button>
          </div>
        )}

        {/* Newsletter */}
        <div style={{ marginTop:48, background:'rgba(0,200,83,0.04)', border:'1px solid rgba(0,200,83,0.15)', borderRadius:16, padding:'36px', textAlign:'center' }}>
          <h3 style={{ fontSize:22, fontWeight:900, marginBottom:8 }}>Get new articles in your inbox</h3>
          <p style={{ color:'var(--muted)', fontSize:14, marginBottom:22 }}>Weekly betting strategy, arb opportunities, and tool updates.</p>
          <div style={{ display:'flex', gap:8, maxWidth:400, margin:'0 auto' }}>
            <input placeholder="you@example.com" style={{ flex:1, background:'var(--bg2)', border:'1px solid var(--border2)', borderRadius:8, padding:'10px 14px', fontSize:14, color:'var(--text)', outline:'none', fontFamily:'inherit' }} />
            <button style={{ background:'var(--green)', color:'#fff', border:'none', borderRadius:8, padding:'10px 20px', fontSize:13, fontWeight:700, cursor:'pointer', fontFamily:'inherit', whiteSpace:'nowrap' }}>Subscribe →</button>
          </div>
        </div>
      </div>

      <PublicFooter />
    </div>
  )
}
