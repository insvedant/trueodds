'use client'
import { useState, useEffect, useRef } from 'react'

// ── US Regulations Data ───────────────────────────────────────────────────────
const US_UPDATES = [
  { date:'May 2026', source:'AGA', impact:'Info', title:'US legal sports betting live in 38 states + DC', summary:'The American Gaming Association reports 38 states plus DC now have legal sports betting. Revenue surpassed $13.7B in 2025, with NY, NJ, and IL leading in handle.', link:'https://www.americangaming.org' },
  { date:'March 2026', source:'NY RGA', impact:'Medium', title:'New York issues guidance on promotional betting restrictions', summary:'New York Gaming Commission updated guidance limiting promotional bet advertising on social media. Operators must include responsible gambling messaging in all promotions effective Q2 2026.', link:'https://www.gaming.ny.gov' },
  { date:'January 2026', source:'FTC', impact:'Medium', title:'FTC issues warning to sportsbooks on misleading bonus advertising', summary:'The FTC issued guidance letters to several major US sportsbooks regarding misleading bonus terms. Books must disclose wagering requirements prominently under updated guidelines.', link:'https://www.ftc.gov' },
  { date:'November 2025', source:'PA GCB', impact:'Low', title:'Pennsylvania expands self-exclusion to all licensed operators', summary:'PA Gaming Control Board updated its self-exclusion registry to automatically apply across all licensed online sports betting operators.', link:'https://gamingcontrolboard.pa.gov' },
]

const US_STATES = [
  { state:'New Jersey',    since:'2018', regulator:'NJ Division of Gaming Enforcement', link:'https://www.nj.gov/oag/ge/' },
  { state:'New York',      since:'2022', regulator:'NY Gaming Commission',              link:'https://www.gaming.ny.gov' },
  { state:'Pennsylvania',  since:'2019', regulator:'PA Gaming Control Board',           link:'https://gamingcontrolboard.pa.gov' },
  { state:'Illinois',      since:'2020', regulator:'IL Gaming Board',                   link:'https://www.igb.illinois.gov' },
  { state:'Michigan',      since:'2021', regulator:'MI Gaming Control Board',           link:'https://www.michigan.gov/mgcb' },
  { state:'Colorado',      since:'2020', regulator:'CO Division of Gaming',             link:'https://sbg.colorado.gov' },
  { state:'Arizona',       since:'2021', regulator:'AZ Dept of Gaming',                link:'https://gaming.az.gov' },
  { state:'Tennessee',     since:'2020', regulator:'TN Sports Wagering Council',        link:'https://sos.tn.gov' },
  { state:'Virginia',      since:'2021', regulator:'VA Lottery',                        link:'https://www.valottery.com' },
  { state:'Ohio',          since:'2023', regulator:'OH Casino Control Commission',      link:'https://casinocontrol.ohio.gov' },
  { state:'Massachusetts', since:'2023', regulator:'MA Gaming Commission',              link:'https://massgaming.com' },
  { state:'Maryland',      since:'2022', regulator:'MD Lottery & Gaming',               link:'https://www.mdlottery.com' },
]

// ── CA Regulations Data ───────────────────────────────────────────────────────
const CA_UPDATES = [
  { date:'May 2025', source:'AGCO', impact:'Low', title:'New responsible gambling display requirements for Ontario operators', summary:'AGCO updated its Standards for Internet Gaming to require all licensed Ontario operators to display responsible gambling messaging more prominently on homepage and bet slip screens.', link:'https://www.agco.ca/lottery-and-gaming/internet-gaming' },
  { date:'March 2025', source:'iGO', impact:'Info', title:'iGaming Ontario reports record $67.5B in wagers for FY2024-25', summary:'iGaming Ontario released its annual report showing continued growth. 49 operators now active. Player protection tools usage up 18% year-over-year.', link:'https://igamingontario.ca' },
  { date:'January 2025', source:'AGCO', impact:'Low', title:'Self-exclusion database integration deadline extended to Q3 2025', summary:'AGCO extended the deadline for all licensed operators to integrate with the province-wide self-exclusion database (GameSense) to Q3 2025.', link:'https://www.agco.ca' },
  { date:'November 2024', source:'iGO', impact:'Medium', title:'Player deposit limits: new operator reporting requirements', summary:'iGaming Ontario introduced mandatory reporting for operators on voluntary deposit limit usage rates.', link:'https://igamingontario.ca' },
  { date:'October 2024', source:'AGCO', impact:'Medium', title:'Updated Standards for Internet Gaming — bonus advertising rules', summary:'New restrictions on how licensed operators can advertise bonuses. Terms must be clearly displayed upfront; hidden wagering requirements are prohibited.', link:'https://www.agco.ca/lottery-and-gaming/internet-gaming' },
]

const impactConfig: Record<string, { bg: string; color: string; dot: string }> = {
  Info:   { bg:'rgba(59,130,246,0.1)',   color:'#3b82f6', dot:'#3b82f6' },
  Low:    { bg:'rgba(0,200,83,0.1)',     color:'var(--green)', dot:'#00C853' },
  Medium: { bg:'rgba(249,168,37,0.12)',  color:'#f0a500', dot:'#f0a500' },
  High:   { bg:'rgba(239,68,68,0.12)',   color:'#ef4444', dot:'#ef4444' },
}
const sourceConfig: Record<string, { bg: string; color: string }> = {
  AGCO:    { bg:'rgba(59,130,246,0.1)',  color:'#3b82f6' },
  iGO:     { bg:'rgba(137,87,229,0.1)', color:'#8957e5' },
  AGA:     { bg:'rgba(59,130,246,0.1)', color:'#3b82f6' },
  'NY RGA':{ bg:'rgba(137,87,229,0.1)', color:'#8957e5' },
  FTC:     { bg:'rgba(239,68,68,0.1)',  color:'#ef4444' },
  'PA GCB':{ bg:'rgba(240,165,0,0.1)',  color:'#f0a500' },
}

function useInView() {
  const ref = useRef<HTMLAnchorElement>(null)
  const [visible, setVisible] = useState(false)
  useEffect(() => {
    const el = ref.current; if (!el) return
    const obs = new IntersectionObserver(([e]) => { if (e.isIntersecting) { setVisible(true); obs.disconnect() } }, { threshold: 0.1 })
    obs.observe(el); return () => obs.disconnect()
  }, [])
  return { ref, visible }
}

function UpdateCard({ u }: { u: typeof CA_UPDATES[0] }) {
  const imp = impactConfig[u.impact]
  const src = sourceConfig[u.source] || { bg:'var(--bg4)', color:'var(--muted)' }
  const { ref, visible } = useInView()
  return (
    <a ref={ref} href={u.link} target="_blank" rel="noreferrer" style={{ textDecoration:'none', display:'block', background:'var(--bg3)', border:'1px solid var(--border)', borderRadius:12, padding:'16px 20px', transition:'border-color 0.15s, transform 0.15s', opacity:visible?1:0, transform:visible?'translateY(0)':'translateY(12px)' }}
      onMouseEnter={e=>{(e.currentTarget as HTMLElement).style.borderColor='rgba(0,200,83,0.3)';(e.currentTarget as HTMLElement).style.transform='translateY(-1px)'}}
      onMouseLeave={e=>{(e.currentTarget as HTMLElement).style.borderColor='var(--border)';(e.currentTarget as HTMLElement).style.transform=''}}>
      <div style={{ display:'flex', gap:8, marginBottom:8, flexWrap:'wrap' as const, alignItems:'center' }}>
        <span style={{ background:src.bg, color:src.color, fontSize:10, fontWeight:700, padding:'2px 8px', borderRadius:20 }}>{u.source}</span>
        <span style={{ background:imp.bg, color:imp.color, fontSize:10, fontWeight:700, padding:'2px 8px', borderRadius:20, display:'flex', alignItems:'center', gap:4 }}>
          <span style={{ width:5, height:5, borderRadius:'50%', background:imp.dot, display:'inline-block' }} />{u.impact}
        </span>
        <span style={{ fontSize:11, color:'var(--dim)' }}>{u.date}</span>
        <span style={{ marginLeft:'auto', fontSize:11, color:'var(--green)', fontWeight:600 }}>View ↗</span>
      </div>
      <div style={{ fontSize:14, fontWeight:700, color:'var(--text)', marginBottom:6 }}>{u.title}</div>
      <div style={{ fontSize:13, color:'var(--muted)', lineHeight:1.65 }}>{u.summary}</div>
    </a>
  )
}

export default function RegulatoryPage() {
  const [isUS, setIsUS] = useState(false)
  const [filter, setFilter] = useState('All')

  useEffect(() => {
    setIsUS(typeof window !== 'undefined' && window.location.hostname.includes('trueodds.us'))
  }, [])

  const updates = isUS ? US_UPDATES : CA_UPDATES
  const filtered = updates.filter(u => filter === 'All' || u.impact === filter)

  return (
    <div style={{ padding:'clamp(16px,3vw,28px)', maxWidth:900, margin:'0 auto' }}>
      <style>{`
        @media (max-width: 640px) {
          .reg-state-table { font-size: 11px !important; }
          .reg-state-table th, .reg-state-table td { padding: 8px 10px !important; }
        }
      `}</style>

      {/* Header */}
      <div style={{ marginBottom:28 }}>
        <div style={{ display:'flex', alignItems:'center', gap:12, marginBottom:8, flexWrap:'wrap' as const }}>
          <h1 style={{ fontSize:'clamp(18px,3vw,22px)', fontWeight:900, margin:0 }}>
            {isUS ? '🇺🇸 US Sports Betting Regulations' : '🇨🇦 Canadian Sports Betting Regulations'}
          </h1>
          <span style={{ background:'rgba(59,130,246,0.1)', color:'#3b82f6', fontSize:11, fontWeight:700, padding:'3px 10px', borderRadius:20 }}>Updated June 2026</span>
        </div>
        <p style={{ color:'var(--muted)', fontSize:14, lineHeight:1.7, margin:0 }}>
          {isUS
            ? 'Stay current with US sports betting regulations, state-by-state legal status, and responsible gambling resources. Minimum age is 21+ in all US states.'
            : 'Stay current with Canadian sports betting regulations, provincial updates from AGCO and iGaming Ontario, and responsible gambling resources. Minimum age is 19+ in most provinces (18+ in Alberta, Manitoba, Quebec).'}
        </p>
      </div>

      {/* Key facts */}
      <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fill,minmax(180px,1fr))', gap:12, marginBottom:28 }}>
        {(isUS ? [
          { label:'States with legal betting', val:'38 + DC',     color:'#00C853' },
          { label:'Minimum age (all states)',   val:'21+',         color:'#3b82f6' },
          { label:'2025 US betting revenue',    val:'$13.7B',      color:'#8957e5' },
          { label:'Regulated operators',        val:'100+',        color:'#f0a500' },
        ] : [
          { label:'Ontario licensed operators', val:'49+',         color:'#00C853' },
          { label:'Minimum age (most provinces)',val:'19+',        color:'#3b82f6' },
          { label:'FY2024-25 wagers (Ontario)', val:'$67.5B',      color:'#8957e5' },
          { label:'Regulatory body',            val:'AGCO / iGO',  color:'#f0a500' },
        ]).map(s=>(
          <div key={s.label} style={{ background:'var(--bg3)', border:'1px solid var(--border)', borderRadius:12, padding:'16px 18px' }}>
            <div style={{ fontSize:20, fontWeight:900, color:s.color, marginBottom:4 }}>{s.val}</div>
            <div style={{ fontSize:12, color:'var(--muted)' }}>{s.label}</div>
          </div>
        ))}
      </div>

      {/* Responsible Gambling */}
      <div style={{ background:'rgba(239,68,68,0.05)', border:'1px solid rgba(239,68,68,0.2)', borderRadius:14, padding:'20px 22px', marginBottom:28 }}>
        <div style={{ fontWeight:800, fontSize:14, marginBottom:12, color:'#ef4444' }}>🆘 Problem Gambling Resources</div>
        <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fill,minmax(220px,1fr))', gap:10 }}>
          {(isUS ? [
            { name:'National Council on Problem Gambling', contact:'1-800-522-4700', hours:'24/7', link:'https://www.ncpgambling.org' },
            { name:'Crisis Text Line', contact:'Text HOME to 741741', hours:'24/7', link:'https://www.crisistextline.org' },
            { name:'Gamblers Anonymous', contact:'gamblersanonymous.org', hours:'Online meetings', link:'https://www.gamblersanonymous.org' },
            { name:'SAMHSA Helpline', contact:'1-800-662-4357', hours:'24/7 treatment referrals', link:'https://www.samhsa.gov' },
          ] : [
            { name:'ConnexOntario', contact:'1-866-531-2600', hours:'24/7', link:'https://www.connexontario.ca' },
            { name:'NCPG (Canada)', contact:'1-800-522-4700', hours:'24/7', link:'https://www.ncpgambling.org' },
            { name:'Gamblers Anonymous Canada', contact:'gamblersanonymous.org', hours:'Online meetings', link:'https://www.gamblersanonymous.org' },
            { name:'Problem Gambling Institute', contact:'problemgambling.ca', hours:'Resources & treatment', link:'https://www.problemgambling.ca' },
          ]).map(r=>(
            <a key={r.name} href={r.link} target="_blank" rel="noreferrer" style={{ textDecoration:'none', background:'var(--bg3)', border:'1px solid var(--border)', borderRadius:10, padding:'12px 14px', display:'block' }}>
              <div style={{ fontSize:12, fontWeight:700, color:'var(--text)', marginBottom:4 }}>{r.name}</div>
              <div style={{ fontSize:13, color:'#ef4444', fontWeight:700, marginBottom:2 }}>{r.contact}</div>
              <div style={{ fontSize:11, color:'var(--dim)' }}>{r.hours}</div>
            </a>
          ))}
        </div>
      </div>

      {/* US State table */}
      {isUS && (
        <div style={{ background:'var(--bg3)', border:'1px solid var(--border)', borderRadius:14, marginBottom:28, overflow:'hidden' }}>
          <div style={{ padding:'16px 20px', borderBottom:'1px solid var(--border)', fontWeight:800, fontSize:14 }}>📍 State-by-State Legal Status</div>
          <div style={{ overflowX:'auto' }}>
            <table className="reg-state-table" style={{ width:'100%', borderCollapse:'collapse' }}>
              <thead>
                <tr style={{ borderBottom:'1px solid var(--border)' }}>
                  {['State','Legal Since','Regulator','Min Age'].map(h=>(
                    <th key={h} style={{ padding:'10px 16px', textAlign:'left', fontSize:11, fontWeight:700, color:'var(--dim)' }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {US_STATES.map((s,i)=>(
                  <tr key={s.state} style={{ borderBottom:i<US_STATES.length-1?'1px solid var(--border)':'none', background:i%2===0?'transparent':'rgba(255,255,255,0.01)' }}>
                    <td style={{ padding:'10px 16px', fontSize:13, fontWeight:600 }}>
                      <a href={s.link} target="_blank" rel="noreferrer" style={{ color:'var(--text)', textDecoration:'none' }}>{s.state} ↗</a>
                    </td>
                    <td style={{ padding:'10px 16px', fontSize:13, color:'var(--muted)' }}>{s.since}</td>
                    <td style={{ padding:'10px 16px', fontSize:12, color:'var(--dim)' }}>{s.regulator}</td>
                    <td style={{ padding:'10px 16px' }}><span style={{ background:'rgba(59,130,246,0.1)', color:'#3b82f6', fontSize:11, fontWeight:700, padding:'2px 10px', borderRadius:20 }}>21+</span></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Updates */}
      <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:16, flexWrap:'wrap' as const, gap:10 }}>
        <div style={{ fontWeight:800, fontSize:15 }}>📋 Recent Regulatory Updates</div>
        <div style={{ display:'flex', gap:6 }}>
          {['All','Info','Low','Medium','High'].map(f=>(
            <button key={f} onClick={()=>setFilter(f)}
              style={{ padding:'5px 14px', borderRadius:20, fontSize:11, fontWeight:700, cursor:'pointer', fontFamily:'inherit', border:'none', background:filter===f?'var(--green)':'var(--bg3)', color:filter===f?'#000':'var(--muted)', transition:'all 0.15s' }}>{f}</button>
          ))}
        </div>
      </div>
      <div style={{ display:'flex', flexDirection:'column' as const, gap:12 }}>
        {filtered.map((u,i)=><UpdateCard key={i} u={u} />)}
      </div>

      {/* Disclaimer */}
      <div style={{ marginTop:28, padding:'16px 20px', background:'var(--bg3)', border:'1px solid var(--border)', borderRadius:12, fontSize:12, color:'var(--dim)', lineHeight:1.7 }}>
        ⚠️ <strong style={{ color:'var(--muted)' }}>Disclaimer:</strong> This page is for informational purposes only and does not constitute legal advice.
        {isUS ? ' Sports betting laws vary by state. Always verify legal status in your state before placing bets. Must be 21+ to use sportsbooks.' : ' Always verify current regulations with your provincial authority. Must be 19+ in most Canadian provinces (18+ in AB, MB, QC).'}
        {' '}TrueOdds is a data analytics tool — we do not accept bets or operate as a sportsbook.
      </div>
    </div>
  )
}
