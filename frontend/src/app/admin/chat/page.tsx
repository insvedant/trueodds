'use client'
import { useState, useEffect, useRef, useCallback } from 'react'
import { api } from '@/lib/auth'

type Message = { _id:string; sender:'user'|'admin'; senderName?:string; text:string; createdAt:string }
type Convo   = { _id:string; status:string; unreadAdmin:number; lastMessage:string; lastMessageAt:string
  user:{ _id:string; name:string; email:string; plan:string; subscriptionStatus:string } }

const STATUS_COLOR: Record<string,string> = { open:'#f0a500', active:'#00C853', resolved:'#6b7280' }
const PLAN_COLOR:   Record<string,string> = { free:'#6b7280', basic:'#00C853', gold:'#f0a500', platinum:'#8957e5' }
const POLL_MS = 4000

export default function AdminChatPage() {
  const [convos, setConvos]           = useState<Convo[]>([])
  const [selected, setSelected]       = useState<Convo | null>(null)
  const [messages, setMessages]       = useState<Message[]>([])
  const [text, setText]               = useState('')
  const [filter, setFilter]           = useState('all')
  const [loadingMsgs, setLoadingMsgs] = useState(false)
  const [loadingList, setLoadingList] = useState(true)
  const [sending, setSending]         = useState(false)
  const [totalUnread, setTotalUnread] = useState(0)
  const [sendError, setSendError]     = useState('')
  const [mobileView, setMobileView]   = useState<'list'|'chat'>('list')

  const bottomRef   = useRef<HTMLDivElement>(null)
  const inputRef    = useRef<HTMLInputElement>(null)
  const selectedRef = useRef<Convo | null>(null)
  const lastMsgId   = useRef('')
  const pollRef     = useRef<NodeJS.Timeout | undefined>(undefined)

  useEffect(() => { selectedRef.current = selected }, [selected])

  const loadConvos = useCallback(async () => {
    try {
      const [cr, ur] = await Promise.all([
        api.get(`/chat/admin/conversations?status=${filter}`),
        api.get('/chat/admin/unread'),
      ])
      setConvos(cr.data.conversations || [])
      setTotalUnread(ur.data.unread || 0)
    } catch {} finally { setLoadingList(false) }
  }, [filter])

  useEffect(() => { setLoadingList(true); loadConvos() }, [loadConvos])
  useEffect(() => { const t = setInterval(loadConvos, 10000); return () => clearInterval(t) }, [loadConvos])

  
  useEffect(() => {
    if (!selected) return
    const poll = async () => {
      if (!selectedRef.current) return
      try {
        const r = await api.get(`/chat/admin/conversations/${selectedRef.current._id}`)
        const msgs: Message[] = r.data.messages || []
        if (msgs.length > 0 && msgs[msgs.length-1]._id !== lastMsgId.current) {
          lastMsgId.current = msgs[msgs.length-1]._id
          setMessages(msgs)
        }
      } catch {}
    }
    pollRef.current = setInterval(poll, POLL_MS)
    return () => { if (pollRef.current) clearInterval(pollRef.current) }
  }, [selected?._id])

  useEffect(() => { bottomRef.current?.scrollIntoView({ behavior:'smooth' }) }, [messages])

  const selectConvo = async (convo: Convo) => {
    setSelected(convo)
    setMobileView('chat')
    lastMsgId.current = ''
    setLoadingMsgs(true)
    setSendError('')
    try {
      const r = await api.get(`/chat/admin/conversations/${convo._id}`)
      const msgs = r.data.messages || []
      setMessages(msgs)
      if (msgs.length > 0) lastMsgId.current = msgs[msgs.length-1]._id
      setConvos(prev => prev.map(c => c._id === convo._id ? { ...c, unreadAdmin:0 } : c))
    } finally {
      setLoadingMsgs(false)
      setTimeout(() => inputRef.current?.focus(), 150)
    }
  }

  const backToList = () => { setMobileView('list'); setSelected(null) }

  const send = async () => {
    const msgText = text.trim()
    if (!msgText || !selected || sending) return
    setSending(true); setSendError(''); setText('')
    const tempId = `temp_${Date.now()}`
    setMessages(prev => [...prev, { _id:tempId, sender:'admin', senderName:'You', text:msgText, createdAt:new Date().toISOString() }])
    try {
      const r = await api.post('/chat/admin/send', { text:msgText, conversationId:selected._id })
      const saved = r.data.message
      setMessages(prev => prev.map(m => m._id === tempId ? saved : m))
      if (saved?._id) lastMsgId.current = saved._id
      loadConvos()
    } catch (err:any) {
      setMessages(prev => prev.filter(m => m._id !== tempId))
      setText(msgText)
      setSendError(err.response?.data?.message || 'Failed to send.')
    } finally { setSending(false) }
  }

  const updateStatus = async (status: string) => {
    if (!selected) return
    try {
      await api.patch(`/chat/admin/conversations/${selected._id}/status`, { status })
      setSelected(s => s ? { ...s, status } : s)
      setConvos(prev => prev.map(c => c._id === selected._id ? { ...c, status } : c))
    } catch {}
  }

  const filtered = convos.filter(c => filter === 'all' || c.status === filter)

  return (
    <div style={{ display:'flex', height:'calc(100dvh - 62px)', overflow:'hidden', background:'var(--bg)', position:'relative' }}>
      <style>{`
        @keyframes msgIn   { from{opacity:0;transform:translateY(6px)} to{opacity:1;transform:translateY(0)} }
        @keyframes slideIn { from{opacity:0;transform:translateX(20px)} to{opacity:1;transform:translateX(0)} }
        @keyframes spin    { to{transform:rotate(360deg)} }
        @keyframes fadeIn  { from{opacity:0} to{opacity:1} }

        .convo-row { transition:background 0.12s; cursor:pointer; -webkit-tap-highlight-color:transparent; }
        .convo-row:hover, .convo-row:active { background:var(--hover-bg)!important; }
        .send-btn { transition:all 0.18s cubic-bezier(0.34,1.56,0.64,1); }
        .send-btn:hover:not(:disabled) { transform:scale(1.08); }
        .send-btn:active:not(:disabled) { transform:scale(0.95); }
        .filter-btn { transition:all 0.15s; -webkit-tap-highlight-color:transparent; }

        /* ── Desktop: side by side ── */
        @media (min-width:641px) {
          .chat-list-panel  { display:flex!important; width:280px!important; }
          .chat-detail-panel { display:flex!important; }
          .mobile-back { display:none!important; }
        }

        /* ── Mobile: single panel at a time ── */
        @media (max-width:640px) {
          .chat-list-panel  { position:absolute!important; inset:0!important; width:100%!important; z-index:1!important; }
          .chat-detail-panel { position:absolute!important; inset:0!important; width:100%!important; z-index:2!important; }
          .chat-detail-panel.hidden { display:none!important; }
          .chat-list-panel.hidden   { display:none!important; }
          .mobile-back { display:flex!important; }
          .status-btns { gap:4px!important; }
          .status-btns button { padding:4px 8px!important; font-size:10px!important; }
          .chat-input-area { padding:8px 10px!important; }
        }
      `}</style>

      {}
      <div className={`chat-list-panel${mobileView === 'chat' ? ' hidden' : ''}`}
        style={{ display:'flex', flexDirection:'column', borderRight:'1px solid var(--border)', background:'var(--bg)', flexShrink:0, overflow:'hidden' }}>

        {}
        <div style={{ padding:'14px 14px 10px', borderBottom:'1px solid var(--border)', flexShrink:0, background:'var(--bg)' }}>
          <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:10 }}>
            <div style={{ display:'flex', alignItems:'center', gap:8 }}>
              <span style={{ fontWeight:900, fontSize:16 }}>💬</span>
              <span style={{ fontWeight:800, fontSize:15 }}>Support Inbox</span>
              {totalUnread > 0 && (
                <span style={{ background:'#ef4444', color:'#fff', fontSize:10, fontWeight:900, padding:'2px 7px', borderRadius:20, animation:'fadeIn 0.3s ease' }}>{totalUnread}</span>
              )}
            </div>
            <button onClick={loadConvos}
              style={{ background:'var(--bg3)', border:'1px solid var(--border)', color:'var(--muted)', cursor:'pointer', fontSize:13, padding:'5px 10px', borderRadius:8, fontFamily:'inherit', transition:'color 0.15s' }}>
              ↻
            </button>
          </div>
          {}
          <div style={{ display:'flex', gap:5, background:'var(--bg3)', borderRadius:10, padding:3 }}>
            {['all','open','active','resolved'].map(f => (
              <button key={f} onClick={() => setFilter(f)} className="filter-btn"
                style={{ flex:1, padding:'6px 4px', borderRadius:8, border:'none', background:filter===f?'var(--bg)':'transparent', color:filter===f?'var(--text)':'var(--dim)', fontSize:'clamp(9px,2vw,11px)', fontWeight:filter===f?700:500, cursor:'pointer', fontFamily:'inherit', boxShadow:filter===f?'0 1px 3px rgba(0,0,0,0.2)':'none', textTransform:'capitalize' as const }}>
                {f}
              </button>
            ))}
          </div>
        </div>

        {}
        <div style={{ flex:1, overflowY:'auto', overflowX:'hidden' }}>
          {loadingList && (
            <div style={{ display:'flex', justifyContent:'center', padding:32 }}>
              <div style={{ width:20, height:20, border:'2px solid var(--border)', borderTopColor:'var(--green)', borderRadius:'50%', animation:'spin 0.8s linear infinite' }} />
            </div>
          )}
          {!loadingList && filtered.length === 0 && (
            <div style={{ textAlign:'center', padding:'32px 16px', color:'var(--dim)' }}>
              <div style={{ fontSize:32, marginBottom:8, opacity:0.3 }}>💬</div>
              <div style={{ fontSize:13 }}>No conversations</div>
            </div>
          )}
          {filtered.map(c => {
            const pc = PLAN_COLOR[c.user?.plan] || '#6b7280'
            const sc = STATUS_COLOR[c.status] || '#6b7280'
            const isActive = selected?._id === c._id
            return (
              <div key={c._id} className="convo-row"
                onClick={() => selectConvo(c)}
                style={{ padding:'12px 14px', borderBottom:'1px solid var(--border)', background:isActive?'rgba(0,200,83,0.06)':'transparent', position:'relative' }}>
                {}
                {isActive && <div style={{ position:'absolute', left:0, top:0, bottom:0, width:3, background:'var(--green)', borderRadius:'0 2px 2px 0' }} />}
                <div style={{ display:'flex', alignItems:'flex-start', gap:10 }}>
                  {}
                  <div style={{ width:38, height:38, borderRadius:'50%', background:`${pc}22`, border:`1.5px solid ${pc}44`, display:'flex', alignItems:'center', justifyContent:'center', fontSize:15, fontWeight:900, color:pc, flexShrink:0 }}>
                    {c.user?.name?.charAt(0).toUpperCase()}
                  </div>
                  <div style={{ flex:1, minWidth:0 }}>
                    <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', gap:6, marginBottom:3 }}>
                      <div style={{ fontWeight:700, fontSize:13, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' as const, flex:1 }}>{c.user?.name}</div>
                      <div style={{ display:'flex', alignItems:'center', gap:5, flexShrink:0 }}>
                        {c.unreadAdmin > 0 && <span style={{ background:'#ef4444', color:'#fff', fontSize:10, fontWeight:900, padding:'1px 6px', borderRadius:20, minWidth:18, textAlign:'center' as const }}>{c.unreadAdmin}</span>}
                        <span style={{ fontSize:9, background:`${sc}18`, color:sc, padding:'2px 7px', borderRadius:20, fontWeight:700, textTransform:'capitalize' as const }}>{c.status}</span>
                      </div>
                    </div>
                    <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', gap:6 }}>
                      <div style={{ fontSize:11, color:'var(--dim)', overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' as const, flex:1 }}>
                        {c.lastMessage || 'No messages yet'}
                      </div>
                      <div style={{ fontSize:10, color:`${pc}`, fontWeight:600, flexShrink:0 }}>{c.user?.plan}</div>
                    </div>
                    {c.lastMessageAt && (
                      <div style={{ fontSize:10, color:'var(--dim)', marginTop:2 }}>
                        {new Date(c.lastMessageAt).toLocaleString([], { month:'short', day:'numeric', hour:'2-digit', minute:'2-digit' })}
                      </div>
                    )}
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      </div>

      {}
      <div className={`chat-detail-panel${mobileView === 'list' && !selected ? ' hidden' : ''}`}
        style={{ flex:1, display:'flex', flexDirection:'column', minWidth:0, background:'var(--bg)', animation: mobileView==='chat' ? 'slideIn 0.25s ease' : 'none' }}>

        {!selected ? (
          <div style={{ flex:1, display:'flex', alignItems:'center', justifyContent:'center', flexDirection:'column', gap:12, color:'var(--dim)', padding:24 }}>
            <div style={{ fontSize:48, opacity:0.2 }}>💬</div>
            <div style={{ fontSize:14, fontWeight:600 }}>Select a conversation</div>
            <div style={{ fontSize:12, color:'var(--dim)', textAlign:'center' as const }}>Choose a conversation from the list to start replying</div>
          </div>
        ) : (
          <>
            {}
            <div style={{ padding:'10px 14px', borderBottom:'1px solid var(--border)', display:'flex', alignItems:'center', gap:10, flexShrink:0, background:'var(--bg3)' }}>
              {}
              <button className="mobile-back" onClick={backToList}
                style={{ display:'none', alignItems:'center', justifyContent:'center', width:34, height:34, borderRadius:10, background:'var(--bg)', border:'1px solid var(--border)', cursor:'pointer', flexShrink:0, WebkitTapHighlightColor:'transparent' as any }}>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="var(--text)" strokeWidth="2.5" strokeLinecap="round"><polyline points="15 18 9 12 15 6"/></svg>
              </button>

              {}
              <div style={{ width:36, height:36, borderRadius:'50%', background:`${PLAN_COLOR[selected.user?.plan]||'#6b7280'}22`, border:`1.5px solid ${PLAN_COLOR[selected.user?.plan]||'#6b7280'}44`, display:'flex', alignItems:'center', justifyContent:'center', fontSize:15, fontWeight:900, color:PLAN_COLOR[selected.user?.plan]||'#6b7280', flexShrink:0 }}>
                {selected.user?.name?.charAt(0).toUpperCase()}
              </div>
              <div style={{ flex:1, minWidth:0 }}>
                <div style={{ fontWeight:800, fontSize:14, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' as const }}>{selected.user?.name}</div>
                <div style={{ fontSize:11, color:'var(--muted)', display:'flex', alignItems:'center', gap:6, flexWrap:'wrap' as const }}>
                  <span style={{ overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' as const }}>{selected.user?.email}</span>
                  <span style={{ color:PLAN_COLOR[selected.user?.plan]||'#6b7280', fontWeight:700, flexShrink:0 }}>{selected.user?.plan}</span>
                </div>
              </div>
              {}
              <div className="status-btns" style={{ display:'flex', gap:5, flexShrink:0 }}>
                {['open','active','resolved'].map(s => (
                  <button key={s} onClick={() => updateStatus(s)}
                    style={{ padding:'5px 10px', borderRadius:8, border:`1px solid ${selected.status===s?(STATUS_COLOR[s]||'var(--green)'):'var(--border)'}`, background:selected.status===s?`${STATUS_COLOR[s]||'var(--green)'}18`:'transparent', color:selected.status===s?(STATUS_COLOR[s]||'var(--green)'):'var(--muted)', fontSize:10, fontWeight:selected.status===s?700:500, cursor:'pointer', fontFamily:'inherit', textTransform:'capitalize' as const, WebkitTapHighlightColor:'transparent' as any }}>
                    {s}
                  </button>
                ))}
              </div>
            </div>

            {}
            <div style={{ flex:1, overflowY:'auto', padding:'14px clamp(10px,3vw,16px)', display:'flex', flexDirection:'column', gap:8 }}>
              {loadingMsgs && (
                <div style={{ display:'flex', justifyContent:'center', padding:24 }}>
                  <div style={{ width:22, height:22, border:'2px solid var(--border)', borderTopColor:'var(--green)', borderRadius:'50%', animation:'spin 0.8s linear infinite' }} />
                </div>
              )}
              {!loadingMsgs && messages.length === 0 && (
                <div style={{ textAlign:'center', padding:'32px 16px', color:'var(--dim)', fontSize:13 }}>
                  No messages yet. Be the first to say hello 👋
                </div>
              )}
              {messages.map(msg => {
                const isAdmin = msg.sender === 'admin'
                const isTemp  = msg._id.startsWith('temp_')
                const pc = PLAN_COLOR[selected.user?.plan] || '#6b7280'
                return (
                  <div key={msg._id} style={{ display:'flex', justifyContent:isAdmin?'flex-end':'flex-start', animation:'msgIn 0.2s ease', gap:8, alignItems:'flex-end' }}>
                    {!isAdmin && (
                      <div style={{ width:28, height:28, borderRadius:'50%', background:`${pc}22`, border:`1px solid ${pc}33`, display:'flex', alignItems:'center', justifyContent:'center', fontSize:12, fontWeight:900, color:pc, flexShrink:0 }}>
                        {selected.user?.name?.charAt(0)}
                      </div>
                    )}
                    <div style={{ maxWidth:'72%', minWidth:0 }}>
                      <div style={{ background:isAdmin?'var(--green)':'var(--bg3)', color:isAdmin?'#000':'var(--text)', borderRadius:isAdmin?'18px 18px 4px 18px':'18px 18px 18px 4px', padding:'10px 14px', fontSize:13, lineHeight:1.55, wordBreak:'break-word' as const, opacity:isTemp?0.65:1, transition:'opacity 0.3s' }}>
                        {msg.text}
                      </div>
                      <div style={{ fontSize:10, color:'var(--dim)', marginTop:4, textAlign:isAdmin?'right':'left' as const, display:'flex', gap:6, justifyContent:isAdmin?'flex-end':'flex-start', alignItems:'center' }}>
                        {isTemp ? <span style={{ color:'var(--dim)', fontStyle:'italic' }}>sending...</span>
                          : <span>{new Date(msg.createdAt).toLocaleTimeString([], { hour:'2-digit', minute:'2-digit' })}</span>}
                        {isAdmin && !isTemp && <span style={{ color:'var(--green)', fontWeight:600 }}>✓ You</span>}
                      </div>
                    </div>
                    {isAdmin && (
                      <div style={{ width:28, height:28, borderRadius:'50%', background:'rgba(0,200,83,0.15)', border:'1px solid rgba(0,200,83,0.3)', display:'flex', alignItems:'center', justifyContent:'center', fontSize:11, fontWeight:900, color:'var(--green)', flexShrink:0 }}>
                        A
                      </div>
                    )}
                  </div>
                )
              })}
              <div ref={bottomRef} />
            </div>

            {}
            {sendError && (
              <div style={{ padding:'6px 14px', fontSize:12, color:'#ef4444', background:'rgba(239,68,68,0.06)', borderTop:'1px solid rgba(239,68,68,0.15)', display:'flex', alignItems:'center', gap:6 }}>
                <span>⚠️</span>{sendError}
              </div>
            )}

            {}
            <div className="chat-input-area" style={{ padding:'10px 14px', borderTop:'1px solid var(--border)', display:'flex', gap:8, alignItems:'center', flexShrink:0, background:'var(--bg3)' }}>
              <input
                ref={inputRef}
                value={text}
                onChange={e => setText(e.target.value)}
                onKeyDown={e => e.key==='Enter' && !e.shiftKey && (e.preventDefault(), send())}
                placeholder={`Reply to ${selected.user?.name?.split(' ')[0]}...`}
                disabled={sending}
                style={{ flex:1, background:'var(--bg)', border:'1.5px solid var(--border)', borderRadius:14, padding:'10px 14px', fontSize:14, color:'var(--text)', fontFamily:'inherit', outline:'none', transition:'border-color 0.15s', minWidth:0 }}
                onFocus={e => e.target.style.borderColor='var(--green)'}
                onBlur={e => e.target.style.borderColor='var(--border)'}
              />
              <button onClick={send} disabled={!text.trim() || sending} className="send-btn"
                style={{ width:42, height:42, borderRadius:'50%', background:text.trim()&&!sending?'var(--green)':'var(--bg)', border:`1.5px solid ${text.trim()&&!sending?'var(--green)':'var(--border)'}`, cursor:text.trim()&&!sending?'pointer':'not-allowed', display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0, WebkitTapHighlightColor:'transparent' as any }}>
                {sending
                  ? <div style={{ width:14, height:14, border:'2px solid rgba(0,0,0,0.2)', borderTopColor:'#000', borderRadius:'50%', animation:'spin 0.7s linear infinite' }} />
                  : <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke={text.trim()?'#000':'var(--dim)'} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><line x1="22" y1="2" x2="11" y2="13"/><polygon points="22 2 15 22 11 13 2 9 22 2"/></svg>}
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  )
}
