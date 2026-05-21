'use client'
import { useEffect, useState, useCallback } from 'react'

/* ─── Single confetti particle ──────────────────────────────────────────── */
type Particle = {
  id: number; x: number; y: number; vx: number; vy: number
  color: string; size: number; rotation: number; vr: number; shape: 'circle'|'rect'|'star'
}

const COLORS = ['#00C853','#58a6ff','#f0a500','#8957e5','#f85149','#00e5ff','#ffd600']

function randomParticle(id: number, originX = 50, originY = 50): Particle {
  const angle = (Math.random() * 360) * (Math.PI / 180)
  const speed = 4 + Math.random() * 8
  return {
    id,
    x:   originX, y: originY,
    vx:  Math.cos(angle) * speed,
    vy:  Math.sin(angle) * speed - 6,
    color:    COLORS[Math.floor(Math.random() * COLORS.length)],
    size:     4 + Math.random() * 6,
    rotation: Math.random() * 360,
    vr:       (Math.random() - 0.5) * 12,
    shape:    (['circle','rect','star'] as const)[Math.floor(Math.random() * 3)],
  }
}

/* ─── Sparkle burst component ───────────────────────────────────────────── */
export function SparkleBurst({ active, onDone, originX = 50, originY = 50, count = 40 }: {
  active: boolean; onDone?: () => void; originX?: number; originY?: number; count?: number
}) {
  const [particles, setParticles] = useState<Particle[]>([])
  const [frame, setFrame]         = useState(0)

  useEffect(() => {
    if (!active) { setParticles([]); setFrame(0); return }
    setParticles(Array.from({ length: count }, (_, i) => randomParticle(i, originX, originY)))
    setFrame(0)
  }, [active, count, originX, originY])

  useEffect(() => {
    if (!active || particles.length === 0) return
    if (frame > 60) { setParticles([]); onDone?.(); return }
    const raf = requestAnimationFrame(() => {
      setFrame(f => f + 1)
      setParticles(prev => prev
        .map(p => ({
          ...p,
          x:  p.x + p.vx,
          y:  p.y + p.vy,
          vy: p.vy + 0.4, // gravity
          vx: p.vx * 0.98,
          rotation: p.rotation + p.vr,
        }))
        .filter(p => p.y < 110 && p.x > -10 && p.x < 110)
      )
    })
    return () => cancelAnimationFrame(raf)
  }, [active, frame, particles, onDone])

  if (!active || particles.length === 0) return null

  return (
    <div style={{ position: 'fixed', inset: 0, pointerEvents: 'none', zIndex: 9999, overflow: 'hidden' }}>
      {particles.map(p => {
        const opacity = Math.max(0, 1 - frame / 60)
        const style: React.CSSProperties = {
          position: 'absolute',
          left:     `${p.x}%`,
          top:      `${p.y}%`,
          width:    p.size,
          height:   p.shape === 'rect' ? p.size * 0.4 : p.size,
          background: p.color,
          borderRadius: p.shape === 'circle' ? '50%' : p.shape === 'rect' ? 2 : 0,
          transform: `rotate(${p.rotation}deg)`,
          opacity,
          transition: 'none',
        }
        if (p.shape === 'star') {
          return (
            <div key={p.id} style={{ ...style, background: 'transparent', color: p.color, fontSize: p.size * 1.5, lineHeight: 1 }}>★</div>
          )
        }
        return <div key={p.id} style={style} />
      })}
    </div>
  )
}

/* ─── Win celebration toast ─────────────────────────────────────────────── */
export function WinToast({ message, amount, onClose }: { message: string; amount?: string; onClose: () => void }) {
  const [visible, setVisible] = useState(true)

  useEffect(() => {
    const t = setTimeout(() => { setVisible(false); setTimeout(onClose, 400) }, 4000)
    return () => clearTimeout(t)
  }, [onClose])

  return (
    <div style={{
      position: 'fixed', bottom: 24, right: 24, zIndex: 9998,
      background: 'linear-gradient(135deg, #0d2b1a 0%, #0a1f13 100%)',
      border: '1px solid rgba(0,200,83,0.5)',
      borderRadius: 14, padding: '16px 20px',
      boxShadow: '0 8px 40px rgba(0,200,83,0.25)',
      display: 'flex', alignItems: 'center', gap: 14,
      minWidth: 280, maxWidth: 360,
      transform: visible ? 'translateX(0)' : 'translateX(120%)',
      opacity: visible ? 1 : 0,
      transition: 'all 0.4s cubic-bezier(0.34,1.56,0.64,1)',
      animation: visible ? 'slideInRight 0.4s cubic-bezier(0.34,1.56,0.64,1)' : 'none',
    }}>
      <style>{`@keyframes slideInRight { from { transform:translateX(120%); opacity:0 } to { transform:translateX(0); opacity:1 } }`}</style>
      <div style={{ fontSize: 32, flexShrink: 0 }}>🎉</div>
      <div style={{ flex: 1 }}>
        <div style={{ fontWeight: 800, fontSize: 14, color: '#e6edf3', marginBottom: 2 }}>{message}</div>
        {amount && <div style={{ fontSize: 22, fontWeight: 900, color: '#00C853', lineHeight: 1.2 }}>{amount}</div>}
      </div>
      <button onClick={() => { setVisible(false); setTimeout(onClose, 400) }}
        style={{ background: 'none', border: 'none', color: 'rgba(255,255,255,0.3)', cursor: 'pointer', fontSize: 18, padding: 0, lineHeight: 1 }}>×</button>
    </div>
  )
}

/* ─── Revenue ping (admin dashboard) ───────────────────────────────────── */
export function RevenuePing({ amount, plan, onClose }: { amount: number; plan: string; onClose: () => void }) {
  const [visible, setVisible] = useState(true)
  const planColor = plan === 'platinum' ? '#8957e5' : '#f0a500'

  useEffect(() => {
    const t = setTimeout(() => { setVisible(false); setTimeout(onClose, 400) }, 5000)
    return () => clearTimeout(t)
  }, [onClose])

  return (
    <div style={{
      position: 'fixed', top: 20, right: 20, zIndex: 9998,
      background: 'var(--bg2)',
      border: `1px solid ${planColor}66`,
      borderRadius: 14, padding: '14px 18px',
      boxShadow: `0 8px 32px ${planColor}33`,
      display: 'flex', alignItems: 'center', gap: 12,
      minWidth: 260,
      transform: visible ? 'translateX(0) scale(1)' : 'translateX(120%) scale(0.9)',
      opacity: visible ? 1 : 0,
      transition: 'all 0.4s cubic-bezier(0.34,1.56,0.64,1)',
    }}>
      <div style={{ fontSize: 28 }}>💰</div>
      <div>
        <div style={{ fontSize: 11, color: 'var(--muted)', marginBottom: 2, textTransform: 'uppercase' as const, letterSpacing: '0.8px', fontWeight: 700 }}>New Subscription!</div>
        <div style={{ fontWeight: 900, fontSize: 18, color: planColor }}>${amount.toFixed(2)}</div>
        <div style={{ fontSize: 11, color: 'var(--dim)', textTransform: 'capitalize' as const }}>{plan} plan</div>
      </div>
      <button onClick={() => { setVisible(false); setTimeout(onClose, 400) }}
        style={{ marginLeft: 'auto', background: 'none', border: 'none', color: 'var(--dim)', cursor: 'pointer', fontSize: 16 }}>×</button>
    </div>
  )
}

/* ─── Hook: useWinCelebration ────────────────────────────────────────────── */
// Call triggerWin() when a bet result changes to 'win'
export function useWinCelebration() {
  const [sparkle, setSparkle] = useState(false)
  const [toasts, setToasts]   = useState<Array<{ id: number; message: string; amount?: string }>>([])
  const nextId = useCallback(() => Date.now(), [])

  const triggerWin = useCallback((message: string, amount?: string) => {
    setSparkle(true)
    setToasts(prev => [...prev, { id: nextId(), message, amount }])
  }, [nextId])

  const removeToast = useCallback((id: number) => {
    setToasts(prev => prev.filter(t => t.id !== id))
  }, [])

  return {
    triggerWin,
    sparkle,
    setSparkle,
    Celebrations: () => (
      <>
        <SparkleBurst active={sparkle} onDone={() => setSparkle(false)} originX={50} originY={40} count={60} />
        {toasts.map(t => <WinToast key={t.id} message={t.message} amount={t.amount} onClose={() => removeToast(t.id)} />)}
      </>
    ),
  }
}

/* ─── Hook: useRevenuePing (admin) ───────────────────────────────────────── */
export function useRevenuePing() {
  const [pings, setPings] = useState<Array<{ id: number; amount: number; plan: string }>>([])
  const [sparkle, setSparkle] = useState(false)

  const triggerRevenue = useCallback((amount: number, plan: string) => {
    setSparkle(true)
    setPings(prev => [...prev, { id: Date.now(), amount, plan }])
  }, [])

  const removePing = useCallback((id: number) => {
    setPings(prev => prev.filter(p => p.id !== id))
  }, [])

  return {
    triggerRevenue,
    RevenueCelebrations: () => (
      <>
        <SparkleBurst active={sparkle} onDone={() => setSparkle(false)} originX={80} originY={10} count={50} />
        {pings.map(p => <RevenuePing key={p.id} amount={p.amount} plan={p.plan} onClose={() => removePing(p.id)} />)}
      </>
    ),
  }
}
