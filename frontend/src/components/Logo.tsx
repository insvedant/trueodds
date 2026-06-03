'use client'
import Link from 'next/link'
import { useEffect, useRef } from 'react'

interface Props {
  size?: 'sm' | 'md' | 'lg'
  linkTo?: string
  collapsed?: boolean
}

export default function Logo({ size = 'md', linkTo = '/', collapsed = false }: Props) {
  const canvasRef  = useRef<HTMLCanvasElement>(null)
  const animRef    = useRef<number>(0)
  const startRef   = useRef<number>(0)   // timestamp when animation started

  const SCALE = size === 'sm' ? 0.17 : size === 'md' ? 0.22 : 0.29
  const cw = collapsed ? Math.round(size === 'sm' ? 36 : size === 'md' ? 48 : 64) : Math.round(800 * SCALE)
  const ch = Math.round(320 * SCALE)

  // Durations in milliseconds
  const ANIM_MS  = 3500   // full animation plays over 3.5s
  const HOLD_MS  = 10000  // hold static for 10s after completing
  const TOTAL_MS = ANIM_MS + HOLD_MS  // 13.5s total cycle

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')!
    canvas.width  = cw
    canvas.height = ch

    const GREEN = '#00C853'
    const sc    = SCALE

    function eout(v: number) { return 1 - Math.pow(1 - Math.min(1, Math.max(0, v)), 3) }
    function clampT(v: number, a = 0, b = 1) { return Math.max(a, Math.min(b, v)) }

    const BARS = [
      { x: 50,  mh: 90,  s: 0    },
      { x: 104, mh: 140, s: 0.07 },
      { x: 158, mh: 190, s: 0.14 },
      { x: 212, mh: 250, s: 0.22 },
    ]
    const BASE_Y = 270

    startRef.current = performance.now()

    const draw = (now: number) => {
      const elapsed = now - startRef.current
      const cycle   = elapsed % TOTAL_MS
      // t is 0→1 during animation, then stays at 1 during hold
      const t = cycle < ANIM_MS ? cycle / ANIM_MS : 1

      ctx.clearRect(0, 0, cw, ch)
      ctx.save()
      ctx.scale(sc, sc)

      // Grid
      const ga = clampT(t / 0.3) * 0.06
      ctx.strokeStyle = `rgba(255,255,255,${ga})`
      ctx.lineWidth = 1
      const gridRight = collapsed ? 290 : 800
      for (let y = 60; y < 320; y += 60) {
        ctx.beginPath(); ctx.moveTo(40, y); ctx.lineTo(gridRight, y); ctx.stroke()
      }

      // Bars grow staggered
      const tops: { x: number; y: number }[] = []
      BARS.forEach(b => {
        const bt = eout(clampT((t - b.s) / 0.28))
        const bh = b.mh * bt
        if (bh > 2) {
          const alpha = 0.3 + 0.7 * (b.x / 250)
          ctx.fillStyle = `rgba(0,200,83,${alpha})`
          ctx.beginPath(); ctx.roundRect(b.x, BASE_Y - bh, 44, bh, 4); ctx.fill()
          ctx.fillStyle = GREEN
          ctx.beginPath(); ctx.roundRect(b.x, BASE_Y - bh, 44, 6, 3); ctx.fill()
        }
        tops.push({ x: b.x + 22, y: BASE_Y - bh })
      })

      // Arrow shoots across bar tops
      if (t > 0.38 && tops[0].y < BASE_Y) {
        const at = eout(clampT((t - 0.38) / 0.28))
        const ex = tops[0].x + (tops[3].x - tops[0].x) * at
        const ey = tops[0].y + (tops[3].y - tops[0].y) * at
        ctx.strokeStyle = 'rgba(255,255,255,0.9)'
        ctx.lineWidth = 4; ctx.lineCap = 'round'; ctx.globalAlpha = 0.9
        ctx.beginPath(); ctx.moveTo(tops[0].x, tops[0].y); ctx.lineTo(ex, ey); ctx.stroke()
        ctx.globalAlpha = 1
        if (at > 0.85) {
          const ang = Math.atan2(tops[3].y - tops[0].y, tops[3].x - tops[0].x)
          ctx.fillStyle = 'rgba(255,255,255,0.9)'
          ctx.globalAlpha = at
          ctx.beginPath()
          ctx.moveTo(ex, ey)
          ctx.lineTo(ex - 22 * Math.cos(ang - 0.5), ey - 22 * Math.sin(ang - 0.5))
          ctx.lineTo(ex - 22 * Math.cos(ang + 0.5), ey - 22 * Math.sin(ang + 0.5))
          ctx.closePath(); ctx.fill()
          ctx.globalAlpha = 1
        }
      }

      // Wordmark
      if (!collapsed) {
        const word = 'TrueOdds'
        if (t > 0.5) {
          const chars    = Math.floor(word.length * clampT((t - 0.5) / 0.25))
          const fontSize = size === 'sm' ? 52 : size === 'md' ? 68 : 88
          ctx.fillStyle    = '#e6edf3'
          ctx.font         = `bold ${fontSize}px Poppins,sans-serif`
          ctx.textBaseline = 'top'
          ctx.fillText(word.slice(0, chars), 295, 80)
          // Cursor blink
          if (chars < word.length && Math.floor(cycle / 500) % 2 === 0) {
            const cw2 = ctx.measureText(word.slice(0, chars)).width
            ctx.fillStyle = GREEN; ctx.fillRect(295 + cw2, 82, 4, fontSize * 0.9)
          }
        }
        if (t > 0.74) {
          const ul = eout(clampT((t - 0.74) / 0.16)) * 450
          ctx.strokeStyle = GREEN; ctx.lineWidth = 3; ctx.globalAlpha = 0.6
          ctx.beginPath(); ctx.moveTo(296, 185); ctx.lineTo(296 + ul, 185); ctx.stroke()
          ctx.globalAlpha = 1
        }
        if (t > 0.8) {
          const tagAlpha = eout(clampT((t - 0.8) / 0.12)) * 0.55
          ctx.globalAlpha = tagAlpha; ctx.fillStyle = '#ffffff'
          ctx.font        = `500 ${size === 'sm' ? 20 : size === 'md' ? 26 : 34}px Poppins,sans-serif`
          ctx.fillText('SPORTS BETTING ANALYTICS', 297, 210)
          ctx.globalAlpha = 1
        }
      }

      ctx.restore()
      animRef.current = requestAnimationFrame(draw)
    }

    animRef.current = requestAnimationFrame(draw)
    return () => cancelAnimationFrame(animRef.current)
  }, [size, collapsed, cw, ch, SCALE, ANIM_MS, HOLD_MS])

  const canvas = <canvas ref={canvasRef} style={{ display:'block' }} aria-label="TrueOdds" />
  if (!linkTo) return canvas
  return (
    <Link href={linkTo} style={{ textDecoration:'none', display:'inline-flex', alignItems:'center', lineHeight:0 }}>
      {canvas}
    </Link>
  )
}
