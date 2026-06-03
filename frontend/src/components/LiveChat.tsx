'use client'
import { useState, useEffect, useRef, useCallback } from 'react'
import { useAuth, api } from '@/lib/auth'

type Message = {
  _id: string; sender: 'user' | 'admin'; senderName?: string
  text: string; createdAt: string
}
type Convo = { _id: string; status: string; unreadUser: number }

const POLL_INTERVAL = 4000 

export default function LiveChat() {
  const { user } = useAuth()
  const [open, setOpen]           = useState(false)
  const [convo, setConvo]         = useState<Convo | null>(null)
  const [messages, setMessages]   = useState<Message[]>([])
  const [text, setText]           = useState('')
  const [unread, setUnread]       = useState(0)
  const [loading, setLoading]     = useState(false)
  const [sending, setSending]     = useState(false)
  const [error, setError]         = useState('')
  const bottomRef  = useRef<HTMLDivElement>(null)
  const inputRef   = useRef<HTMLInputElement>(null)
  const convoRef   = useRef<Convo | null>(null)
  const pollRef    = useRef<NodeJS.Timeout | undefined>(undefined)
  const lastMsgId  = useRef<string>('')
  const isOpenRef  = useRef(false)

  useEffect(() => { convoRef.current = convo }, [convo])
  useEffect(() => { isOpenRef.current = open }, [open])

  
  useEffect(() => {
    if (!open || !user) return
    setLoading(true)
    setError('')
    api.get('/chat/my-conversation')
      .then(r => {
        setConvo(r.data.conversation)
        setMessages(r.data.messages || [])
        setUnread(0)
        if (r.data.messages?.length > 0) {
          lastMsgId.current = r.data.messages[r.data.messages.length - 1]._id
        }
      })
      .catch(() => setError('Could not load chat. Please try again.'))
      .finally(() => setLoading(false))
  }, [open, user])

  
  useEffect(() => {
    if (!open || !convoRef.current) return

    const poll = async () => {
      if (!convoRef.current || !isOpenRef.current) return
      try {
        const r = await api.get(`/chat/my-conversation`)
        const newMsgs: Message[] = r.data.messages || []
        if (newMsgs.length > 0) {
          const latestId = newMsgs[newMsgs.length - 1]._id
          if (latestId !== lastMsgId.current) {
            lastMsgId.current = latestId
            setMessages(newMsgs)
          }
        }
      } catch {}
    }

    pollRef.current = setInterval(poll, POLL_INTERVAL)
    return () => { if (pollRef.current) clearInterval(pollRef.current) }
  }, [open, convo?._id])

  
  useEffect(() => {
    if (!user || open) return
    const poll = () => api.get('/chat/unread').then(r => setUnread(r.data.unread || 0)).catch(() => {})
    poll()
    const t = setInterval(poll, 20000)
    return () => clearInterval(t)
  }, [user, open])

  
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  
  useEffect(() => {
    if (open) setTimeout(() => inputRef.current?.focus(), 250)
  }, [open])

  
  const send = useCallback(async () => {
    const msgText = text.trim()
    if (!msgText || sending) return
    setSending(true)
    setError('')
    setText('')

    
    const tempId = `temp_${Date.now()}`
    const tempMsg: Message = {
      _id: tempId, sender: 'user',
      senderName: user?.name || 'You',
      text: msgText, createdAt: new Date().toISOString(),
    }
    setMessages(prev => [...prev, tempMsg])

    try {
      const r = await api.post('/chat/send', {
        text: msgText,
        conversationId: convoRef.current?._id,
      })
      const saved = r.data.message
      const newConvo = r.data.conversation || convoRef.current

      if (!convoRef.current && newConvo) {
        setConvo(newConvo)
      }

      
      setMessages(prev => prev.map(m => m._id === tempId ? { ...saved, senderName: user?.name || 'You' } : m))
      if (saved?._id) lastMsgId.current = saved._id

    } catch (err: any) {
      
      setMessages(prev => prev.filter(m => m._id !== tempId))
      setText(msgText)
      setError(err.response?.data?.message || 'Failed to send. Please try again.')
    } finally {
      setSending(false)
    }
  }, [text, sending, user])

  const handleKey = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send() }
  }

  if (!user) return null

  return (
    <>
      <style>{`
        @keyframes chatIn    { from{opacity:0;transform:scale(0.94) translateY(10px)} to{opacity:1;transform:scale(1) translateY(0)} }
        @keyframes msgIn     { from{opacity:0;transform:translateY(6px)} to{opacity:1;transform:translateY(0)} }
        @keyframes bounce    { 0%,60%,100%{transform:translateY(0)} 30%{transform:translateY(-6px)} }
        @keyframes badgePop  { from{transform:scale(0)} 70%{transform:scale(1.2)} to{transform:scale(1)} }
        @keyframes spin      { to{transform:rotate(360deg)} }
        @keyframes pulseRing { 0%{transform:scale(1);opacity:0.7} 100%{transform:scale(1.7);opacity:0} }
        @keyframes labelIn   { from{opacity:0;transform:translateX(8px)} to{opacity:1;transform:translateX(0)} }
        .chat-send-btn { transition:all 0.18s cubic-bezier(0.34,1.56,0.64,1); }
        .chat-send-btn:hover:not(:disabled) { transform:scale(1.1); }
        .chat-send-btn:active:not(:disabled) { transform:scale(0.95); }
        @media (max-width:480px) {
          .chat-window { right:0!important;left:0!important;bottom:0!important;width:100%!important;height:100dvh!important;border-radius:0!important;max-height:unset!important; }
          .chat-fab-wrap { bottom:80px!important; }
        }
      `}</style>

      {}
      {open && (
        <div className="chat-window" style={{ position:'fixed', bottom:90, right:20, width:360, height:520, maxHeight:'80vh', background:'var(--bg2)', border:'1px solid var(--border)', borderRadius:20, display:'flex', flexDirection:'column', zIndex:8888, boxShadow:'0 20px 60px rgba(0,0,0,0.5)', animation:'chatIn 0.3s cubic-bezier(0.34,1.56,0.64,1)' }}>

          {}
          <div style={{ padding:'14px 16px', borderBottom:'1px solid var(--border)', display:'flex', alignItems:'center', gap:10, background:'var(--bg3)', borderRadius:'20px 20px 0 0', flexShrink:0 }}>
            <div style={{ width:36, height:36, borderRadius:'50%', background:'rgba(0,200,83,0.15)', border:'2px solid rgba(0,200,83,0.3)', display:'flex', alignItems:'center', justifyContent:'center', fontSize:18, flexShrink:0 }}>💬</div>
            <div style={{ flex:1, minWidth:0 }}>
              <div style={{ fontWeight:800, fontSize:14, color:'var(--text)' }}>TrueOdds Support</div>
              <div style={{ fontSize:11, color:'var(--dim)', display:'flex', alignItems:'center', gap:6 }}>
                <span style={{ width:6, height:6, borderRadius:'50%', background:'#00C853', display:'inline-block' }} />
                Online · typically replies in minutes
              </div>
            </div>
            <button onClick={() => setOpen(false)} style={{ background:'none', border:'none', color:'var(--dim)', cursor:'pointer', fontSize:22, padding:'0 4px', lineHeight:1, WebkitTapHighlightColor:'transparent' as any }}>×</button>
          </div>

          {}
          <div style={{ flex:1, overflowY:'auto', padding:'14px 14px 4px', display:'flex', flexDirection:'column', gap:8 }}>
            {messages.length === 0 && !loading && (
              <div style={{ textAlign:'center', padding:'28px 16px' }}>
                <div style={{ fontSize:40, marginBottom:10 }}>👋</div>
                <div style={{ fontWeight:800, fontSize:14, color:'var(--text)', marginBottom:8 }}>Hi {user.name?.split(' ')[0]}!</div>
                <p style={{ color:'var(--dim)', fontSize:13, lineHeight:1.65, margin:0 }}>Send us a message and we'll get back to you as soon as possible.</p>
              </div>
            )}
            {loading && (
              <div style={{ display:'flex', justifyContent:'center', padding:32 }}>
                <div style={{ width:22, height:22, border:'2px solid var(--border)', borderTopColor:'var(--green)', borderRadius:'50%', animation:'spin 0.8s linear infinite' }} />
              </div>
            )}
            {error && (
              <div style={{ background:'rgba(239,68,68,0.08)', border:'1px solid rgba(239,68,68,0.2)', borderRadius:10, padding:'9px 13px', fontSize:12, color:'#ef4444', animation:'msgIn 0.2s ease' }}>
                ⚠️ {error}
              </div>
            )}
            {messages.map(msg => {
              const isUser = msg.sender === 'user'
              const isTemp = msg._id.startsWith('temp_')
              return (
                <div key={msg._id} style={{ display:'flex', justifyContent:isUser?'flex-end':'flex-start', animation:'msgIn 0.25s ease both' }}>
                  {!isUser && (
                    <div style={{ width:26, height:26, borderRadius:'50%', background:'rgba(0,200,83,0.15)', display:'flex', alignItems:'center', justifyContent:'center', fontSize:12, fontWeight:700, color:'var(--green)', flexShrink:0, marginRight:6, alignSelf:'flex-end', marginBottom:2 }}>S</div>
                  )}
                  <div style={{ maxWidth:'75%' }}>
                    <div style={{ background:isUser?'var(--green)':'var(--bg3)', color:isUser?'#000':'var(--text)', borderRadius:isUser?'16px 16px 4px 16px':'16px 16px 16px 4px', padding:'9px 13px', fontSize:13, lineHeight:1.5, wordBreak:'break-word' as const, opacity:isTemp?0.6:1, transition:'opacity 0.3s' }}>
                      {msg.text}
                    </div>
                    <div style={{ fontSize:10, color:'var(--dim)', marginTop:3, textAlign:isUser?'right':'left' as const }}>
                      {isTemp ? 'sending...' : new Date(msg.createdAt).toLocaleTimeString([], { hour:'2-digit', minute:'2-digit' })}
                    </div>
                  </div>
                </div>
              )
            })}
            <div ref={bottomRef} />
          </div>

          {/* Input */}
          <div style={{ padding:'10px 12px', borderTop:'1px solid var(--border)', display:'flex', gap:8, alignItems:'center', flexShrink:0, background:'var(--bg3)', borderRadius:'0 0 20px 20px' }}>
            <input
              ref={inputRef}
              value={text}
              onChange={e => setText(e.target.value)}
              onKeyDown={handleKey}
              placeholder="Type a message..."
              maxLength={2000}
              disabled={sending}
              style={{ flex:1, background:'var(--bg)', border:'1px solid var(--border)', borderRadius:12, padding:'10px 13px', fontSize:13, color:'var(--text)', fontFamily:'inherit', outline:'none', transition:'border-color 0.15s' }}
              onFocus={e => e.target.style.borderColor='var(--green)'}
              onBlur={e => e.target.style.borderColor='var(--border)'}
            />
            <button onClick={send} disabled={!text.trim() || sending} className="chat-send-btn"
              style={{ width:40, height:40, borderRadius:'50%', background:text.trim()&&!sending?'var(--green)':'var(--bg)', border:`1.5px solid ${text.trim()&&!sending?'var(--green)':'var(--border)'}`, cursor:text.trim()&&!sending?'pointer':'not-allowed', display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0, WebkitTapHighlightColor:'transparent' as any }}>
              {sending
                ? <div style={{ width:14, height:14, border:'2px solid rgba(0,0,0,0.2)', borderTopColor:'#000', borderRadius:'50%', animation:'spin 0.7s linear infinite' }} />
                : <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke={text.trim()?'#000':'var(--dim)'} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><line x1="22" y1="2" x2="11" y2="13"/><polygon points="22 2 15 22 11 13 2 9 22 2"/></svg>
              }
            </button>
          </div>
        </div>
      )}

      {/* FAB — draggable chathead */}
      <DraggableFAB open={open} unread={unread} onToggle={() => setOpen(!open)} />
    </>
  )
}

// ── Draggable FAB (Facebook chathead style) ───────────────────────────────
function DraggableFAB({ open, unread, onToggle }: { open:boolean; unread:number; onToggle:()=>void }) {
  const fabRef  = useRef<HTMLDivElement>(null)
  const posRef  = useRef({ x: 0, y: 0 })
  const dragRef = useRef({ dragging:false, startX:0, startY:0, startPosX:0, startPosY:0, moved:false })
  const [pos, setPos] = useState({ x: -1, y: -1 }) // -1 = use default CSS position

  // Set initial position on mount
  useEffect(() => {
    const isMobile = window.innerWidth <= 640
    if (isMobile) {
      setPos({ x: window.innerWidth - 74, y: window.innerHeight - 120 })
    }
  }, [])

  useEffect(() => {
    posRef.current = pos
  }, [pos])

  const onPointerDown = (e: React.PointerEvent) => {
    if (open) return // don't drag when chat is open
    const d = dragRef.current
    d.dragging  = true
    d.moved     = false
    d.startX    = e.clientX
    d.startY    = e.clientY
    d.startPosX = posRef.current.x
    d.startPosY = posRef.current.y
    ;(e.target as HTMLElement).setPointerCapture(e.pointerId)
  }

  const onPointerMove = (e: React.PointerEvent) => {
    const d = dragRef.current
    if (!d.dragging) return
    const dx = e.clientX - d.startX
    const dy = e.clientY - d.startY
    if (Math.abs(dx) > 4 || Math.abs(dy) > 4) d.moved = true
    if (!d.moved) return

    const size = 62
    const newX = Math.max(8, Math.min(window.innerWidth  - size - 8, d.startPosX + dx))
    const newY = Math.max(8, Math.min(window.innerHeight - size - 8, d.startPosY + dy))
    setPos({ x: newX, y: newY })
  }

  const onPointerUp = (e: React.PointerEvent) => {
    const d = dragRef.current
    if (!d.dragging) return
    d.dragging = false

    
    const size  = 62
    const midX  = window.innerWidth / 2
    const snapX = posRef.current.x < midX ? 8 : window.innerWidth - size - 8
    setPos(p => ({ ...p, x: snapX }))

    
    if (!d.moved) onToggle()
    d.moved = false
  }

  const isMobile = typeof window !== 'undefined' && window.innerWidth <= 640
  const hasPos   = pos.x !== -1

  return (
    <div
      ref={fabRef}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      className="chat-fab-wrap"
      style={{
        position:  'fixed',
        bottom:    (!isMobile || !hasPos) ? 24   : 'auto',
        right:     (!isMobile || !hasPos) ? 20   : 'auto',
        left:      (isMobile && hasPos)   ? pos.x : 'auto',
        top:       (isMobile && hasPos)   ? pos.y : 'auto',
        zIndex:    8889,
        display:   'flex',
        flexDirection: 'column' as const,
        alignItems: 'flex-end',
        gap:       10,
        touchAction: 'none',
        userSelect: 'none',
      }}>

      {}
      {!open && !isMobile && (
        <div style={{ background:'var(--bg2)', border:'1px solid var(--border)', borderRadius:20, padding:'6px 14px', fontSize:12, fontWeight:700, color:'var(--text)', whiteSpace:'nowrap' as const, boxShadow:'0 4px 16px rgba(0,0,0,0.35)', animation:'labelIn 0.4s ease 1.2s both', pointerEvents:'none' }}>
          💬 Live chat support
        </div>
      )}

      <div style={{ position:'relative' }}>
        {}
        {!open && (
          <>
            <span style={{ position:'absolute', inset:-4, borderRadius:'50%', border:'2px solid rgba(0,200,83,0.5)', animation:'pulseRing 2.2s ease-out infinite', pointerEvents:'none' }} />
            <span style={{ position:'absolute', inset:-4, borderRadius:'50%', border:'2px solid rgba(0,200,83,0.3)', animation:'pulseRing 2.2s ease-out 0.8s infinite', pointerEvents:'none' }} />
          </>
        )}

        {}
        <div
          style={{ width:58, height:58, borderRadius:'50%', background:'#00C853', display:'flex', alignItems:'center', justifyContent:'center', cursor:'grab', WebkitTapHighlightColor:'transparent' as any, boxShadow:'0 6px 28px rgba(0,200,83,0.5)', transition:'box-shadow 0.2s, transform 0.2s', position:'relative', userSelect:'none' }}>

          {}
          {!open && <span style={{ position:'absolute', top:3, right:3, width:13, height:13, borderRadius:'50%', background:'#00e676', border:'2.5px solid #00C853', zIndex:2 }} />}

          {}
          <svg width="25" height="25" viewBox="0 0 24 24" fill="none" strokeLinecap="round" strokeLinejoin="round" style={{ pointerEvents:'none' }}>
            <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" stroke="#000" strokeWidth="2"/>
            <circle cx="8.5" cy="10" r="1.2" fill="#000"/>
            <circle cx="12" cy="10" r="1.2" fill="#000"/>
            <circle cx="15.5" cy="10" r="1.2" fill="#000"/>
          </svg>

          {}
          {unread > 0 && (
            <div style={{ position:'absolute', top:-4, right:-4, minWidth:20, height:20, borderRadius:10, background:'#ef4444', color:'#fff', fontSize:11, fontWeight:900, display:'flex', alignItems:'center', justifyContent:'center', border:'2.5px solid #00C853', padding:'0 4px', boxSizing:'border-box' as const, animation:'badgePop 0.3s cubic-bezier(0.34,1.56,0.64,1)', zIndex:3, pointerEvents:'none' }}>
              {unread > 9 ? '9+' : unread}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
