'use client'
import { useState, useEffect } from 'react'

const MESSAGES: Record<string, string[]> = {
  arb: [
    'Scanning 100+ sportsbooks for guaranteed profit...',
    'Comparing odds across DraftKings, FanDuel, BetMGM...',
    'Hunting for price discrepancies...',
    'Calculating guaranteed profit margins...',
    'Almost there — finding the best arb opportunities...',
  ],
  ev: [
    'Calculating positive expected value across all books...',
    'Comparing against sharp lines from Pinnacle & Bet365...',
    'Running Kelly criterion calculations...',
    'Scanning for mathematically profitable bets...',
    'Almost there — ranking opportunities by edge...',
  ],
  odds: [
    'Fetching live odds from 100+ sportsbooks...',
    'Comparing lines across all major books...',
    'Loading the best available odds...',
    'Almost ready...',
  ],
  default: [
    'Loading live data...',
    'Fetching from TheOddsAPI...',
    'Almost ready...',
  ],
}

interface Props {
  type?: 'arb' | 'ev' | 'odds' | 'default'
  sport?: string
}

export default function LoadingMessage({ type = 'default', sport }: Props) {
  const msgs = MESSAGES[type] || MESSAGES.default
  const [idx, setIdx] = useState(0)

  useEffect(() => {
    const t = setInterval(() => setIdx(i => (i + 1) % msgs.length), 2200)
    return () => clearInterval(t)
  }, [msgs.length])

  return (
    <div style={{ display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center', padding:'clamp(48px,8vw,72px) 24px', gap:20 }}>
      <style>{`
        @keyframes spin      { to{transform:rotate(360deg)} }
        @keyframes fadeMsg   { 0%{opacity:0;transform:translateY(6px)} 20%{opacity:1;transform:translateY(0)} 80%{opacity:1} 100%{opacity:0} }
        @keyframes pulse-dot { 0%,100%{opacity:0.3;transform:scale(0.8)} 50%{opacity:1;transform:scale(1)} }
      `}</style>

      {/* Spinner */}
      <div style={{ position:'relative', width:52, height:52 }}>
        <div style={{ position:'absolute', inset:0, border:'3px solid var(--border)', borderTopColor:'var(--green)', borderRadius:'50%', animation:'spin 0.9s linear infinite' }} />
        <div style={{ position:'absolute', inset:8, border:'2px solid var(--border)', borderTopColor:'rgba(0,200,83,0.4)', borderRadius:'50%', animation:'spin 1.4s linear infinite reverse' }} />
      </div>

      {/* Animated message */}
      <div key={idx} style={{ fontSize:'clamp(13px,2.5vw,15px)', color:'var(--muted)', fontWeight:500, animation:'fadeMsg 2.2s ease forwards', textAlign:'center', maxWidth:360, lineHeight:1.6 }}>
        {sport && sport !== 'All' && (
          <span style={{ color:'var(--green)', fontWeight:700, display:'block', fontSize:12, marginBottom:4, textTransform:'uppercase', letterSpacing:0.6 }}>
            {sport} {type === 'arb' ? 'Arbitrage' : type === 'ev' ? '+EV' : 'Odds'}
          </span>
        )}
        {msgs[idx]}
      </div>

      {/* Dots */}
      <div style={{ display:'flex', gap:6 }}>
        {[0,1,2].map(i => (
          <div key={i} style={{ width:7, height:7, borderRadius:'50%', background:'var(--green)', animation:`pulse-dot 1.4s ease ${i*0.25}s infinite` }} />
        ))}
      </div>
    </div>
  )
}
