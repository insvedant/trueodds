'use client'
import { useState, useEffect } from 'react'
import Link from 'next/link'
import { PublicNavbar, PublicFooter } from '@/components/PublicLayout'
import { useParams } from 'next/navigation'
import axios from 'axios'

const API = (process.env.NEXT_PUBLIC_API_URL || 'https://trueodds.onrender.com') + '/api'

export default function BlogPostPage() {
  const { slug }    = useParams()
  const [post, setPost] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [notFound, setNotFound] = useState(false)

  useEffect(() => {
    if (!slug) return
    axios.get(`${API}/blog/${slug}`)
      .then(r => {
        if (r.data?.success) setPost(r.data.data)
        else setNotFound(true)
      })
      .catch(() => setNotFound(true))
      .finally(() => setLoading(false))
  }, [slug])

  return (
    <div style={{ background:'var(--bg)', color:'var(--text)', minHeight:'100vh' }}>
      <style>{`
        .blog-content h2 { font-size:22px; font-weight:800; margin:28px 0 12px; }
        .blog-content h3 { font-size:18px; font-weight:700; margin:22px 0 10px; }
        .blog-content p  { color:var(--muted); line-height:1.8; margin-bottom:16px; }
        .blog-content ul, .blog-content ol { color:var(--muted); line-height:1.8; padding-left:24px; margin-bottom:16px; }
        .blog-content li { margin-bottom:6px; }
        .blog-content strong { color:var(--text); font-weight:700; }
        .blog-content pre { background:var(--bg3); border:1px solid var(--border); border-radius:8px; padding:16px; overflow-x:auto; font-size:13px; margin-bottom:16px; }
        @keyframes spin { to{transform:rotate(360deg)} }
      `}</style>
      <PublicNavbar />
      <div style={{ maxWidth:720, margin:'0 auto', padding:'80px 24px 60px' }}>
        <Link href="/blog" style={{ fontSize:13, color:'var(--muted)', textDecoration:'none', display:'inline-flex', alignItems:'center', gap:6, marginBottom:32 }}>
          ← Back to Blog
        </Link>

        {loading && (
          <div style={{ textAlign:'center', padding:80 }}>
            <div style={{ width:32, height:32, border:'3px solid var(--border)', borderTopColor:'#00C853', borderRadius:'50%', animation:'spin 0.8s linear infinite', margin:'0 auto' }} />
          </div>
        )}

        {notFound && (
          <div style={{ textAlign:'center', padding:80 }}>
            <div style={{ fontSize:48, marginBottom:16 }}>📭</div>
            <h2 style={{ fontWeight:900, marginBottom:8 }}>Article not found</h2>
            <Link href="/blog" style={{ color:'#00C853', fontWeight:700 }}>Browse all articles →</Link>
          </div>
        )}

        {post && (
          <>
            <div style={{ display:'flex', gap:8, marginBottom:16, flexWrap:'wrap' as const, alignItems:'center' }}>
              <span style={{ background:'rgba(0,200,83,0.1)', color:'#00C853', fontSize:11, fontWeight:700, padding:'3px 12px', borderRadius:20 }}>{post.category}</span>
              {(post.tags||[]).map((t: string) => <span key={t} style={{ fontSize:11, color:'var(--dim)', background:'var(--bg3)', padding:'3px 10px', borderRadius:20 }}>#{t}</span>)}
            </div>
            <div style={{ fontSize:64, marginBottom:20 }}>{post.emoji}</div>
            <h1 style={{ fontSize:'clamp(24px,5vw,40px)', fontWeight:900, letterSpacing:'-1px', marginBottom:12, lineHeight:1.15 }}>{post.title}</h1>
            <p style={{ color:'var(--muted)', fontSize:15, lineHeight:1.7, marginBottom:24 }}>{post.excerpt}</p>
            <div style={{ display:'flex', gap:16, fontSize:12, color:'var(--dim)', marginBottom:40, paddingBottom:24, borderBottom:'1px solid var(--border)' }}>
              <span>By {post.author || 'TrueOdds Team'}</span>
              <span>{new Date(post.createdAt).toLocaleDateString('en-US', { month:'long', day:'numeric', year:'numeric' })}</span>
              <span>{post.readTime} min read</span>
            </div>
            <div className="blog-content" dangerouslySetInnerHTML={{ __html: (post.content || '').replace(/\n/g,'<br/>').replace(/## (.*?)(<br\/>|$)/g,'<h2>$1</h2>').replace(/### (.*?)(<br\/>|$)/g,'<h3>$1</h3>').replace(/\*\*(.*?)\*\*/g,'<strong>$1</strong>') }} />
            <div style={{ marginTop:48, padding:24, background:'var(--bg3)', border:'1px solid var(--border)', borderRadius:12, textAlign:'center' }}>
              <div style={{ fontWeight:800, fontSize:16, marginBottom:8 }}>Ready to find real arbitrage opportunities?</div>
              <Link href="/signup" style={{ display:'inline-block', background:'#00C853', color:'#000', fontWeight:800, padding:'10px 28px', borderRadius:24, textDecoration:'none', fontSize:14 }}>Start 7-Day Free Trial →</Link>
            </div>
          </>
        )}
      </div>
      <PublicFooter />
    </div>
  )
}
