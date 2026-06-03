'use client'
import { useEffect, useState } from 'react'
import { api } from '@/lib/auth'

type ReferralEntry = { name:string; email:string; plan:string; status:string; totalPaid:number; qualified:boolean; joined:string }
type Referrer = {
  id:string; name:string; email:string; plan:string
  referralCode:string; referralLink:string
  totalReferrals:number; qualifiedReferrals:number
  rewardsEarned:number; totalSpentByReferrals:number
  referrals:ReferralEntry[]; joined:string
}
type AdminData = { total:number; page:number; pages:number; threshold:number; data:Referrer[] }

export default function AdminReferralsPage() {
  const [data, setData]       = useState<AdminData | null>(null)
  const [loading, setLoading] = useState(true)
  const [selected, setSelected] = useState<Referrer | null>(null)
  const [search, setSearch]   = useState('')
  const [editRewards, setEditRewards] = useState('')
  const [saving, setSaving]   = useState(false)
  const [saveMsg, setSaveMsg] = useState('')

  const load = async () => {
    setLoading(true)
    try {
      const res = await api.get('/referral/admin/list')
      setData(res.data)
    } catch {}
    finally { setLoading(false) }
  }

  useEffect(() => { load() }, [])

  const filtered = data?.data.filter(r =>
    r.name.toLowerCase().includes(search.toLowerCase()) ||
    r.email.toLowerCase().includes(search.toLowerCase()) ||
    r.referralCode.toLowerCase().includes(search.toLowerCase())
  ) || []

  const saveRewards = async () => {
    if (!selected) return
    setSaving(true); setSaveMsg('')
    try {
      await api.put(`/referral/admin/${selected.id}`, { referralRewards: parseInt(editRewards) })
      setSaveMsg('✓ Saved'); load()
      setTimeout(() => setSaveMsg(''), 2000)
    } catch { setSaveMsg('Error saving') }
    finally { setSaving(false) }
  }

  const totals = data ? {
    totalReferrers:  data.total,
    totalReferrals:  data.data.reduce((s,r) => s+r.totalReferrals, 0),
    totalQualified:  data.data.reduce((s,r) => s+r.qualifiedReferrals, 0),
    totalRewards:    data.data.reduce((s,r) => s+r.rewardsEarned, 0),
    totalSpent:      data.data.reduce((s,r) => s+r.totalSpentByReferrals, 0),
  } : null

  const PLAN_COLOR: Record<string,string> = { free:'var(--muted)', basic:'#00C853', gold:'#f0a500', platinum:'#8957e5' }

  return (
    <div style={{ height:'calc(100vh - 48px)', display:'flex', flexDirection:'column' as const, gap:0 }}>
      <style>{`
        @keyframes slideIn { from{opacity:0;transform:translateX(12px)} to{opacity:1;transform:translateX(0)} }
        .ref-row-admin { transition:background 0.12s; cursor:pointer; }
        .ref-row-admin:hover { background:var(--hover-bg) !important; }
        .input-field:focus { border-color:var(--green) !important; box-shadow:0 0 0 3px rgba(0,200,83,0.1) !important; outline:none !important; }
        @media (max-width:768px) {
          .admin-ref-layout { flex-direction:column !important; }
          .admin-ref-detail { width:100% !important; max-height:50vh !important; }
        }
      `}</style>

      {}
      <div style={{ marginBottom:20 }}>
        <h1 style={{ fontSize:20, fontWeight:900, marginBottom:4 }}>🎁 Referral Management</h1>
        <p style={{ color:'var(--muted)', fontSize:12, margin:0 }}>Track all referrers, their invited users, spend, and reward credits.</p>
      </div>

      {}
      {totals && (
        <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fit,minmax(120px,1fr))', gap:10, marginBottom:20 }}>
          {[
            { label:'Total Referrers', value:totals.totalReferrers,  color:'var(--text)' },
            { label:'Total Invited',   value:totals.totalReferrals,  color:'var(--text)' },
            { label:'Qualified ($50+)',value:totals.totalQualified,  color:'var(--green)' },
            { label:'Rewards Issued',  value:`${totals.totalRewards} mo`, color:'#f0a500' },
            { label:'Revenue via Refs',value:`$${totals.totalSpent.toFixed(0)}`, color:'var(--green)' },
          ].map(s => (
            <div key={s.label} style={{ background:'var(--bg3)', border:'1px solid var(--border)', borderRadius:10, padding:'12px 14px', textAlign:'center' }}>
              <div style={{ fontSize:'clamp(16px,3vw,22px)', fontWeight:900, color:s.color }}>{s.value}</div>
              <div style={{ fontSize:10, color:'var(--dim)', marginTop:4, fontWeight:600 }}>{s.label}</div>
            </div>
          ))}
        </div>
      )}

      {}
      {data && (
        <div style={{ background:'rgba(0,200,83,0.06)', border:'1px solid rgba(0,200,83,0.18)', borderRadius:10, padding:'10px 16px', marginBottom:16, fontSize:12, color:'var(--muted)', display:'flex', alignItems:'center', gap:8 }}>
          <span>⚙️</span>
          <span>Qualification threshold: <strong style={{ color:'var(--green)' }}>${data.threshold}</strong> spent by referred user → referrer earns 1 free month automatically via Stripe webhook.</span>
        </div>
      )}

      {}
      <div style={{ marginBottom:14 }}>
        <input className="input-field" value={search} onChange={e => setSearch(e.target.value)} placeholder="Search by name, email, or referral code..."
          style={{ width:'100%', background:'var(--bg3)', border:'1px solid var(--border)', borderRadius:8, padding:'9px 12px', fontSize:13, color:'var(--text)', fontFamily:'inherit', boxSizing:'border-box' as const }} />
      </div>

      {}
      <div className="admin-ref-layout" style={{ display:'flex', gap:14, flex:1, overflow:'hidden', minHeight:0 }}>
        {}
        <div style={{ flex:1, minWidth:0, overflow:'hidden', display:'flex', flexDirection:'column' as const }}>
          <div style={{ background:'var(--bg3)', border:'1px solid var(--border)', borderRadius:10, overflow:'auto', flex:1 }}>
            {loading ? (
              <div style={{ textAlign:'center', padding:48, color:'var(--muted)' }}>Loading referral data...</div>
            ) : (
              <div style={{overflowX:'auto',WebkitOverflowScrolling:'touch'}}><table style={{ width:'100%', borderCollapse:'collapse', fontSize:13 }}>
                <thead style={{ position:'sticky', top:0, background:'var(--bg4)', zIndex:2 }}>
                  <tr style={{ borderBottom:'1px solid var(--border)' }}>
                    {['Referrer','Code','Invited','Qualified','Rewards','Rev. from Refs','Joined'].map(h => (
                      <th key={h} style={{ padding:'10px 12px', color:'var(--muted)', fontWeight:600, fontSize:10, textAlign: h==='Referrer'?'left':'center', whiteSpace:'nowrap' as const }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {filtered.map(r => (
                    <tr key={r.id} className="ref-row-admin"
                      onClick={() => { setSelected(r); setEditRewards(String(r.rewardsEarned)); setSaveMsg('') }}
                      style={{ borderBottom:'1px solid rgba(48,54,61,0.5)', background: selected?.id===r.id ? 'rgba(0,200,83,0.04)' : 'transparent' }}>
                      <td style={{ padding:'11px 12px' }}>
                        <div style={{ fontWeight:600 }}>{r.name}</div>
                        <div style={{ fontSize:11, color:'var(--muted)' }}>{r.email}</div>
                        <span style={{ fontSize:10, background:PLAN_COLOR[r.plan]+'22', color:PLAN_COLOR[r.plan], padding:'1px 6px', borderRadius:20, fontWeight:700 }}>{r.plan}</span>
                      </td>
                      <td style={{ padding:'11px 12px', textAlign:'center' as const }}>
                        <code style={{ fontSize:11, background:'var(--bg4)', padding:'2px 7px', borderRadius:6, fontWeight:700, color:'var(--green)', letterSpacing:1 }}>{r.referralCode}</code>
                      </td>
                      <td style={{ padding:'11px 12px', textAlign:'center' as const, fontWeight:700 }}>{r.totalReferrals}</td>
                      <td style={{ padding:'11px 12px', textAlign:'center' as const, color:'var(--green)', fontWeight:700 }}>{r.qualifiedReferrals}</td>
                      <td style={{ padding:'11px 12px', textAlign:'center' as const, color:'#f0a500', fontWeight:700 }}>{r.rewardsEarned} mo</td>
                      <td style={{ padding:'11px 12px', textAlign:'center' as const, color:'var(--green)', fontWeight:700 }}>${r.totalSpentByReferrals.toFixed(0)}</td>
                      <td style={{ padding:'11px 12px', textAlign:'center' as const, color:'var(--dim)', fontSize:11 }}>{new Date(r.joined).toLocaleDateString('en-CA',{month:'short',day:'numeric',year:'2-digit'})}</td>
                    </tr>
                  ))}
                  {filtered.length === 0 && (
                    <tr><td colSpan={7} style={{ textAlign:'center', padding:40, color:'var(--muted)' }}>No referrers found.</td></tr>
                  )}
                </tbody>
              </table></div>
            )}
          </div>
        </div>

        {}
        {selected && (
          <div className="admin-ref-detail" style={{ width:300, background:'var(--bg3)', border:'1px solid var(--border)', borderRadius:10, padding:18, overflowY:'auto', flexShrink:0, animation:'slideIn 0.3s ease' }}>
            <div style={{ display:'flex', justifyContent:'space-between', marginBottom:16, alignItems:'center' }}>
              <span style={{ fontWeight:800, fontSize:14 }}>Referrer Detail</span>
              <button onClick={() => setSelected(null)} style={{ background:'none', border:'none', color:'var(--muted)', cursor:'pointer', fontSize:20, lineHeight:1 }}>×</button>
            </div>

            {}
            <div style={{ display:'flex', alignItems:'center', gap:10, padding:'10px 12px', background:'var(--bg)', borderRadius:10, marginBottom:14 }}>
              <div style={{ width:36, height:36, borderRadius:'50%', background:'rgba(0,200,83,0.12)', display:'flex', alignItems:'center', justifyContent:'center', fontWeight:900, color:'var(--green)', fontSize:16, flexShrink:0 }}>
                {selected.name.charAt(0).toUpperCase()}
              </div>
              <div>
                <div style={{ fontWeight:800, fontSize:13 }}>{selected.name}</div>
                <div style={{ fontSize:11, color:'var(--muted)' }}>{selected.email}</div>
              </div>
            </div>

            {}
            <div style={{ background:'var(--bg)', border:'1px solid var(--border)', borderRadius:8, padding:'8px 10px', marginBottom:14 }}>
              <div style={{ fontSize:10, color:'var(--dim)', marginBottom:3, textTransform:'uppercase' as const, letterSpacing:0.5 }}>Referral Link</div>
              <div style={{ fontSize:11, color:'var(--muted)', fontFamily:'monospace', wordBreak:'break-all' as const }}>{selected.referralLink}</div>
            </div>

            {}
            <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:8, marginBottom:14 }}>
              {[
                { label:'Invited', value:selected.totalReferrals },
                { label:'Qualified', value:selected.qualifiedReferrals, color:'var(--green)' },
                { label:'Rev. Generated', value:`$${selected.totalSpentByReferrals.toFixed(0)}`, color:'var(--green)' },
                { label:'Rewards Earned', value:`${selected.rewardsEarned} mo`, color:'#f0a500' },
              ].map(s => (
                <div key={s.label} style={{ background:'var(--bg)', border:'1px solid var(--border)', borderRadius:8, padding:'10px 12px', textAlign:'center' }}>
                  <div style={{ fontSize:16, fontWeight:900, color:s.color||'var(--text)' }}>{s.value}</div>
                  <div style={{ fontSize:10, color:'var(--dim)', marginTop:2 }}>{s.label}</div>
                </div>
              ))}
            </div>

            {}
            <div style={{ marginBottom:14 }}>
              <label style={{ fontSize:11, fontWeight:700, color:'var(--muted)', display:'block', marginBottom:6, textTransform:'uppercase' as const }}>Override Reward Months</label>
              <div style={{ display:'flex', gap:8 }}>
                <input type="number" value={editRewards} onChange={e => setEditRewards(e.target.value)} min={0}
                  style={{ flex:1, background:'var(--bg)', border:'1px solid var(--border)', borderRadius:7, padding:'8px 10px', fontSize:13, color:'var(--text)', fontFamily:'inherit', outline:'none' }} />
                <button onClick={saveRewards} disabled={saving}
                  style={{ background:'var(--green)', border:'none', borderRadius:7, padding:'8px 14px', fontSize:12, fontWeight:700, color:'#000', cursor:'pointer', fontFamily:'inherit', flexShrink:0, opacity:saving?0.6:1 }}>
                  {saving ? '...' : 'Save'}
                </button>
              </div>
              {saveMsg && <div style={{ fontSize:12, color: saveMsg.startsWith('✓') ? 'var(--green)' : '#ef4444', marginTop:6 }}>{saveMsg}</div>}
            </div>

            {}
            {selected.referrals.length > 0 && (
              <div>
                <div style={{ fontSize:12, fontWeight:700, color:'var(--muted)', marginBottom:10, textTransform:'uppercase' as const }}>Invited Users ({selected.referrals.length})</div>
                {selected.referrals.map((r,i) => (
                  <div key={i} style={{ background:'var(--bg)', borderRadius:8, padding:'9px 10px', marginBottom:6, display:'flex', justifyContent:'space-between', alignItems:'center', gap:8 }}>
                    <div style={{ minWidth:0 }}>
                      <div style={{ fontWeight:600, fontSize:12, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' as const }}>{r.name}</div>
                      <div style={{ fontSize:10, color:'var(--dim)' }}>{r.email}</div>
                    </div>
                    <div style={{ display:'flex', flexDirection:'column' as const, alignItems:'flex-end', gap:2, flexShrink:0 }}>
                      <span style={{ fontSize:11, fontWeight:700, color:r.totalPaid>=selected.totalSpentByReferrals?'var(--green)':'var(--muted)' }}>${r.totalPaid.toFixed(0)}</span>
                      <span style={{ fontSize:14 }}>{r.qualified ? '✅' : '⏳'}</span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
