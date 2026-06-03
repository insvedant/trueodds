'use client'
import { useState, useCallback } from 'react'

function americanToDecimal(american: number): number {
  if (american >= 100)  return (american / 100) + 1
  if (american <= -100) return (100 / Math.abs(american)) + 1
  return 1
}

function decimalToAmerican(decimal: number): string {
  if (decimal >= 2) return `+${Math.round((decimal - 1) * 100)}`
  return `${Math.round(-100 / (decimal - 1))}`
}

function impliedProb(american: number): number {
  const dec = americanToDecimal(american)
  return 1 / dec
}

function Label({ children }: { children: React.ReactNode }) {
  return <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--muted)', textTransform: 'uppercase' as const, letterSpacing: '0.8px', marginBottom: 6 }}>{children}</div>
}

function OddsInput({ value, onChange, label }: { value: string; onChange: (v: string) => void; label: string }) {
  return (
    <div>
      <Label>{label}</Label>
      <input
        type="number"
        value={value}
        onChange={e => onChange(e.target.value)}
        placeholder="e.g. -110 or +150"
        style={{ width: '100%', background: 'var(--bg2)', border: '1px solid var(--border)', borderRadius: 8, padding: '10px 12px', fontSize: 15, color: 'var(--text)', outline: 'none', fontFamily: 'inherit', fontWeight: 600 }}
        onFocus={e => (e.target.style.borderColor = '#00C853')}
        onBlur={e => (e.target.style.borderColor = 'var(--border2)')}
      />
    </div>
  )
}

function MoneyInput({ value, onChange, label, prefix = '$' }: { value: string; onChange: (v: string) => void; label: string; prefix?: string }) {
  return (
    <div>
      <Label>{label}</Label>
      <div style={{ position: 'relative' }}>
        <span style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', color: 'var(--muted)', fontSize: 14, fontWeight: 600 }}>{prefix}</span>
        <input
          type="number"
          value={value}
          onChange={e => onChange(e.target.value)}
          placeholder="0"
          style={{ width: '100%', background: 'var(--bg2)', border: '1px solid var(--border)', borderRadius: 8, padding: '10px 12px 10px 26px', fontSize: 15, color: 'var(--text)', outline: 'none', fontFamily: 'inherit', fontWeight: 600 }}
          onFocus={e => (e.target.style.borderColor = '#00C853')}
          onBlur={e => (e.target.style.borderColor = 'var(--border2)')}
        />
      </div>
    </div>
  )
}

function ResultBox({ label, value, color = 'var(--text)', large = false, sub }: { label: string; value: string; color?: string; large?: boolean; sub?: string }) {
  return (
    <div style={{ background: 'var(--bg2)', border: '1px solid var(--border)', borderRadius: 10, padding: '14px 16px', textAlign: 'center' }}>
      <div style={{ fontSize: large ? 28 : 22, fontWeight: 900, color, lineHeight: 1.1 }}>{value}</div>
      {sub && <div style={{ fontSize: 11, color: 'var(--blue)', marginTop: 2, fontWeight: 600 }}>{sub}</div>}
      <div style={{ fontSize: 11, color: 'var(--dim)', marginTop: 5, fontWeight: 500 }}>{label}</div>
    </div>
  )
}

function SectionCard({ title, subtitle, icon, children }: { title: string; subtitle: string; icon: string; children: React.ReactNode }) {
  return (
    <div style={{ background: 'var(--bg3)', border: '1px solid var(--border)', borderRadius: 14, overflow: 'hidden' }}>
      <div className="calc-card-header" style={{ padding: 'clamp(14px,3vw,20px) clamp(14px,4vw,24px)', borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'flex-start', gap: 14 }}>
        <div style={{ fontSize: 28, lineHeight: 1 }}>{icon}</div>
        <div>
          <div style={{ fontWeight: 800, fontSize: 17, marginBottom: 3 }}>{title}</div>
          <div style={{ color: 'var(--muted)', fontSize: 13 }}>{subtitle}</div>
        </div>
      </div>
      <div className="calc-card-body" style={{ padding: 'clamp(14px,4vw,24px)' }}>{children}</div>
    </div>
  )
}

function Divider() {
  return <div style={{ height: 1, background: 'var(--bg4)', margin: '20px 0' }} />
}

function ArbCalculator() {
  const [leg1Odds, setLeg1Odds] = useState('-110')
  const [leg2Odds, setLeg2Odds] = useState('+120')
  const [totalStake, setTotalStake] = useState('1000')
  const [leg1Book, setLeg1Book] = useState('DraftKings')
  const [leg2Book, setLeg2Book] = useState('FanDuel')

  const calc = useCallback(() => {
    const o1 = +leg1Odds, o2 = +leg2Odds, stake = +totalStake
    if (!o1 || !o2 || !stake) return null

    const d1 = americanToDecimal(o1)
    const d2 = americanToDecimal(o2)
    
    const s1 = stake / (1 + d1 / d2)   
    const s2 = stake - s1               
    const ret1 = s1 * d1                
    const ret2 = s2 * d2                
    const minReturn = Math.min(ret1, ret2)
    const profit = minReturn - stake
    const profitPct = (profit / stake) * 100
    
    const prob1 = impliedProb(o1) * 100
    const prob2 = impliedProb(o2) * 100
    const totalProb = prob1 + prob2
    const isArb = totalProb < 100

    return { s1, s2, ret1, ret2, minReturn, profit, profitPct, prob1, prob2, totalProb, isArb, d1, d2 }
  }, [leg1Odds, leg2Odds, totalStake])

  const r = calc()
  const isArb = r?.isArb ?? false

  return (
    <SectionCard icon="⚡" title="Arbitrage Calculator" subtitle="Find guaranteed profit by betting both sides at different sportsbooks">
      <div className="calc-2col" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(200px,1fr))', gap: 12, marginBottom: 16 }}>
        <div>
          <Label>Book 1</Label>
          <input value={leg1Book} onChange={e => setLeg1Book(e.target.value)} style={{ width: '100%', background: 'var(--bg2)', border: '1px solid var(--border)', borderRadius: 8, padding: '10px 12px', fontSize: 14, color: 'var(--text)', outline: 'none', fontFamily: 'inherit', marginBottom: 8 }} placeholder="e.g. DraftKings" />
          <OddsInput value={leg1Odds} onChange={setLeg1Odds} label={`${leg1Book} Odds`} />
        </div>
        <div>
          <Label>Book 2</Label>
          <input value={leg2Book} onChange={e => setLeg2Book(e.target.value)} style={{ width: '100%', background: 'var(--bg2)', border: '1px solid var(--border)', borderRadius: 8, padding: '10px 12px', fontSize: 14, color: 'var(--text)', outline: 'none', fontFamily: 'inherit', marginBottom: 8 }} placeholder="e.g. FanDuel" />
          <OddsInput value={leg2Odds} onChange={setLeg2Odds} label={`${leg2Book} Odds`} />
        </div>
      </div>

      <MoneyInput value={totalStake} onChange={setTotalStake} label="Total Bankroll to Deploy" />

      <Divider />

      {r ? (
        <>
          {}
          <div style={{ background: isArb ? 'rgba(0,200,83,0.07)' : 'rgba(248,81,73,0.07)', border: `1px solid ${isArb ? 'rgba(0,200,83,0.3)' : 'rgba(248,81,73,0.3)'}`, borderRadius: 10, padding: '12px 16px', marginBottom: 16, display: 'flex', alignItems: 'center', gap: 10 }}>
            <div style={{ width: 8, height: 8, borderRadius: '50%', background: isArb ? '#00C853' : '#f85149', flexShrink: 0 }} />
            <div>
              <div style={{ fontWeight: 700, fontSize: 14, color: isArb ? '#00C853' : '#f85149' }}>
                {isArb ? '✓ Arbitrage Opportunity Found!' : '✗ No Arbitrage — Combined probability too high'}
              </div>
              <div style={{ fontSize: 12, color: 'var(--muted)', marginTop: 2 }}>
                Combined implied probability: <strong style={{ color: r.totalProb < 100 ? '#00C853' : '#f85149' }}>{r.totalProb.toFixed(2)}%</strong>
                {isArb ? ' (must be < 100% for arb to exist)' : ' (must be < 100% for arb to exist)'}
              </div>
            </div>
          </div>

          {}
          <div className="calc-2col" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(200px,1fr))', gap: 10, marginBottom: 14 }}>
            <div style={{ background: 'var(--bg2)', border: '1px solid var(--border)', borderRadius: 10, padding: '14px 16px' }}>
              <Label>Bet on {leg1Book}</Label>
              <div style={{ fontSize: 26, fontWeight: 900, color: 'var(--green)' }}>${r.s1.toFixed(2)}</div>
              <div style={{ fontSize: 12, color: 'var(--muted)', marginTop: 4 }}>Odds: {leg1Odds} (decimal: {r.d1.toFixed(3)})</div>
              <div style={{ fontSize: 12, color: 'var(--muted)' }}>Return if win: <strong style={{ color: 'var(--text)' }}>${r.ret1.toFixed(2)}</strong></div>
            </div>
            <div style={{ background: 'var(--bg2)', border: '1px solid var(--border)', borderRadius: 10, padding: '14px 16px' }}>
              <Label>Bet on {leg2Book}</Label>
              <div style={{ fontSize: 26, fontWeight: 900, color: 'var(--green)' }}>${r.s2.toFixed(2)}</div>
              <div style={{ fontSize: 12, color: 'var(--muted)', marginTop: 4 }}>Odds: {leg2Odds} (decimal: {r.d2.toFixed(3)})</div>
              <div style={{ fontSize: 12, color: 'var(--muted)' }}>Return if win: <strong style={{ color: 'var(--text)' }}>${r.ret2.toFixed(2)}</strong></div>
            </div>
          </div>

          <div className="calc-4col" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(120px,1fr))', gap: 10 }}>
            <ResultBox label="Total Staked" value={`$${(+totalStake).toFixed(2)}`} />
            <ResultBox label="Guaranteed Return" value={`$${r.minReturn.toFixed(2)}`} color="var(--text)" />
            <ResultBox label="Guaranteed Profit" value={`${r.profit >= 0 ? '+' : ''}$${r.profit.toFixed(2)}`} color={r.profit >= 0 ? '#00C853' : '#f85149'} large />
            <ResultBox label="Profit %" value={`${r.profitPct >= 0 ? '+' : ''}${r.profitPct.toFixed(2)}%`} color={r.profitPct >= 0 ? '#00C853' : '#f85149'} large />
          </div>

        </>
      ) : (
        <div style={{ textAlign: 'center', color: 'var(--dim)', padding: '20px 0' }}>Enter odds and stake to calculate</div>
      )}
    </SectionCard>
  )
}

function EVCalculator() {
  const [bookOdds, setBookOdds] = useState('+145')
  const [fairOdds, setFairOdds] = useState('+130')
  const [stake, setStake] = useState('100')
  const [bankroll, setBankroll] = useState('5000')
  const [kellyFraction, setKellyFraction] = useState('0.25')

  const calc = useCallback(() => {
    const bo = +bookOdds, fo = +fairOdds, s = +stake, br = +bankroll, kf = +kellyFraction
    if (!bo || !fo) return null

    const bookDec = americanToDecimal(bo)
    const fairDec = americanToDecimal(fo)
    
    const trueProb = 1 / fairDec
    
    const evPct = (trueProb * bookDec - 1) * 100
    const evDollar = (s * evPct) / 100
    
    
    const b = bookDec - 1
    const p = trueProb
    const q = 1 - p
    const kellyPct = Math.max(0, (b * p - q) / b) * 100
    const kellyStake = br * (kellyPct / 100) * kf
    
    const bookImplied = impliedProb(bo) * 100
    const fairImplied = trueProb * 100
    const edge = fairImplied - bookImplied  

    return { bookDec, fairDec, trueProb, evPct, evDollar, kellyPct, kellyStake, bookImplied, fairImplied, edge }
  }, [bookOdds, fairOdds, stake, bankroll, kellyFraction])

  const r = calc()
  const hasEdge = (r?.evPct ?? 0) > 0

  return (
    <SectionCard icon="📈" title="+EV (Expected Value) Calculator" subtitle="Find the true value of a bet — how much you mathematically expect to gain or lose per dollar wagered">
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 12 }}>
        <OddsInput value={bookOdds} onChange={setBookOdds} label="Sportsbook Odds (what they offer)" />
        <OddsInput value={fairOdds} onChange={setFairOdds} label="Fair / No-Vig Odds (true value)" />
      </div>
      <div className="calc-3col" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(150px,1fr))', gap: 12 }}>
        <MoneyInput value={stake} onChange={setStake} label="Bet Amount ($)" />
        <MoneyInput value={bankroll} onChange={setBankroll} label="Total Bankroll ($)" />
        <div>
          <Label>Kelly Fraction (0.25 = quarter)</Label>
          <input type="number" value={kellyFraction} onChange={e => setKellyFraction(e.target.value)} step="0.05" min="0.05" max="1"
            style={{ width: '100%', background: 'var(--bg2)', border: '1px solid var(--border)', borderRadius: 8, padding: '10px 12px', fontSize: 15, color: 'var(--text)', outline: 'none', fontFamily: 'inherit', fontWeight: 600 }} />
        </div>
      </div>

      <div style={{ background: 'rgba(88,166,255,0.06)', border: '1px solid rgba(88,166,255,0.2)', borderRadius: 8, padding: '10px 14px', marginTop: 12, fontSize: 12, color: 'var(--muted)' }}>
        💡 <strong style={{ color: 'var(--blue)' }}>Fair odds</strong> = the true price with no house edge. Find them from sharp books (Pinnacle, Circa) or use a no-vig calculator. The gap between book odds and fair odds is your edge.
      </div>

      <Divider />

      {r ? (
        <>
          <div style={{ background: hasEdge ? 'rgba(0,200,83,0.07)' : 'rgba(248,81,73,0.07)', border: `1px solid ${hasEdge ? 'rgba(0,200,83,0.3)' : 'rgba(248,81,73,0.3)'}`, borderRadius: 10, padding: '12px 16px', marginBottom: 16, display: 'flex', alignItems: 'center', gap: 10 }}>
            <div style={{ width: 8, height: 8, borderRadius: '50%', background: hasEdge ? '#00C853' : '#f85149', flexShrink: 0 }} />
            <div style={{ fontWeight: 700, fontSize: 14, color: hasEdge ? '#00C853' : '#f85149' }}>
              {hasEdge ? `✓ Positive EV — You have +${r.evPct.toFixed(2)}% edge on this bet` : `✗ Negative EV — Avoid this bet (${r.evPct.toFixed(2)}% edge)`}
            </div>
          </div>

          {}
          <div style={{ marginBottom: 16 }}>
            <Label>Probability Comparison</Label>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
              <div style={{ background: 'var(--bg2)', borderRadius: 8, padding: '12px 14px', border: '1px solid var(--border)' }}>
                <div style={{ fontSize: 11, color: 'var(--red)', fontWeight: 700, marginBottom: 4 }}>BOOK IMPLIED PROB</div>
                <div style={{ fontSize: 22, fontWeight: 900 }}>{r.bookImplied.toFixed(2)}%</div>
                <div style={{ fontSize: 11, color: 'var(--muted)' }}>What the book thinks</div>
              </div>
              <div style={{ background: 'var(--bg2)', borderRadius: 8, padding: '12px 14px', border: '1px solid rgba(0,200,83,0.2)' }}>
                <div style={{ fontSize: 11, color: 'var(--green)', fontWeight: 700, marginBottom: 4 }}>TRUE PROBABILITY</div>
                <div style={{ fontSize: 22, fontWeight: 900, color: 'var(--green)' }}>{r.fairImplied.toFixed(2)}%</div>
                <div style={{ fontSize: 11, color: 'var(--muted)' }}>From fair odds (no vig)</div>
              </div>
            </div>
            <div style={{ background: 'var(--bg2)', borderRadius: 8, padding: '10px 14px', marginTop: 8, border: '1px solid var(--border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ fontSize: 13, color: 'var(--muted)' }}>Your edge (true prob − book implied)</span>
              <span style={{ fontSize: 16, fontWeight: 900, color: r.edge > 0 ? '#00C853' : '#f85149' }}>{r.edge > 0 ? '+' : ''}{r.edge.toFixed(2)}%</span>
            </div>
          </div>

          <div className="calc-4col" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(120px,1fr))', gap: 10, marginBottom: 14 }}>
            <ResultBox label="EV per $100 wagered" value={`${r.evPct >= 0 ? '+' : ''}$${r.evPct.toFixed(2)}`} color={r.evPct >= 0 ? '#00C853' : '#f85149'} />
            <ResultBox label={`EV on $${stake} bet`} value={`${r.evDollar >= 0 ? '+' : ''}$${r.evDollar.toFixed(2)}`} color={r.evDollar >= 0 ? '#00C853' : '#f85149'} large />
            <ResultBox label="Full Kelly %" value={`${r.kellyPct.toFixed(2)}%`} color="#58a6ff" sub="of bankroll" />
            <ResultBox label={`Kelly Stake (×${kellyFraction})`} value={`$${r.kellyStake.toFixed(2)}`} color="#58a6ff" large />
          </div>

          {}
          <div style={{ background: 'var(--bg2)', border: '1px solid var(--border)', borderRadius: 8, padding: '12px 16px', fontSize: 12, color: 'var(--muted)', lineHeight: 1.7 }}>
            <strong style={{ color: 'var(--blue)' }}>Kelly Criterion:</strong> Bet {r.kellyPct.toFixed(2)}% of your bankroll on this play.
            At quarter Kelly (×{kellyFraction}), that's <strong style={{ color: 'var(--text)' }}>${r.kellyStake.toFixed(2)}</strong> on a ${(+bankroll).toLocaleString()} bankroll.
            Quarter Kelly is safer — it reduces variance while capturing most of the long-run growth.
          </div>

        </>
      ) : (
        <div style={{ textAlign: 'center', color: 'var(--dim)', padding: '20px 0' }}>Enter odds to calculate</div>
      )}
    </SectionCard>
  )
}

// ─── BET TRACKER CALCULATOR ────────────────────────────────────────────────
function BetTrackerCalculator() {
  const [bets, setBets] = useState([
    { id: 1, game: 'Chiefs vs Ravens', odds: '-110', stake: '110', result: 'win' },
    { id: 2, game: 'Lakers vs Celtics', odds: '+135', stake: '100', result: 'loss' },
    { id: 3, game: 'Wild vs Avalanche', odds: '+322', stake: '50', result: 'win' },
    { id: 4, game: 'Jones vs Miocic', odds: '-175', stake: '175', result: 'pending' },
  ])
  const [newBet, setNewBet] = useState({ game: '', odds: '', stake: '' })

  const calcProfit = (odds: number, stake: number, result: string): number => {
    if (result === 'pending') return 0
    if (result === 'loss') return -stake
    // win
    if (odds >= 100)  return Math.round((stake * odds) / 100)
    if (odds <= -100) return Math.round((stake * 100) / Math.abs(odds))
    return 0
  }

  const addBet = () => {
    if (!newBet.game || !newBet.odds || !newBet.stake) return
    setBets([...bets, { id: Date.now(), game: newBet.game, odds: newBet.odds, stake: newBet.stake, result: 'pending' }])
    setNewBet({ game: '', odds: '', stake: '' })
  }

  const setResult = (id: number, result: string) => setBets(bets.map(b => b.id === id ? { ...b, result } : b))
  const removeBet = (id: number) => setBets(bets.filter(b => b.id !== id))

  // Stats
  const settled = bets.filter(b => b.result !== 'pending')
  const wins = bets.filter(b => b.result === 'win')
  const totalProfit = settled.reduce((sum, b) => sum + calcProfit(+b.odds, +b.stake, b.result), 0)
  const totalStaked = settled.reduce((sum, b) => sum + +b.stake, 0)
  const roi = totalStaked > 0 ? (totalProfit / totalStaked) * 100 : 0
  const winRate = settled.length > 0 ? (wins.length / settled.length) * 100 : 0
  const avgOdds = settled.length > 0 ? settled.reduce((sum, b) => sum + americanToDecimal(+b.odds), 0) / settled.length : 0
  const expectedWinRate = avgOdds > 0 ? (1 / avgOdds) * 100 : 0
  const clv = winRate - expectedWinRate  // closing line value proxy

  const profitByBet = bets.map(b => ({ ...b, profit: calcProfit(+b.odds, +b.stake, b.result) }))
  const runningPnL: number[] = []
  let running = 0
  settled.forEach(b => { running += calcProfit(+b.odds, +b.stake, b.result); runningPnL.push(running) })
  const maxPnL = Math.max(...runningPnL.map(Math.abs), 1)

  return (
    <SectionCard icon="📊" title="Bet Performance Calculator" subtitle="Log your bets, track P&L, ROI, win rate, and closing line value over time">
      {/* Stats row */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))', gap: 10, marginBottom: 20 }}>
        <ResultBox label="Total P&L" value={`${totalProfit >= 0 ? '+' : ''}$${totalProfit}`} color={totalProfit >= 0 ? '#00C853' : '#f85149'} large />
        <ResultBox label="ROI" value={`${roi >= 0 ? '+' : ''}${roi.toFixed(1)}%`} color={roi >= 0 ? '#00C853' : '#f85149'} />
        <ResultBox label="Win Rate" value={`${winRate.toFixed(0)}%`} color="#58a6ff" />
        <ResultBox label="Total Staked" value={`$${totalStaked}`} />
        <ResultBox label="Settled" value={`${settled.length} bets`} />
        <ResultBox label="CLV Proxy" value={`${clv >= 0 ? '+' : ''}${clv.toFixed(1)}%`} color={clv >= 0 ? '#00C853' : '#f85149'} sub="win% vs implied%" />
      </div>

      {/* Running P&L chart */}
      {runningPnL.length > 0 && (
        <div style={{ marginBottom: 20 }}>
          <Label>Running P&L</Label>
          <div style={{ background: 'var(--bg2)', border: '1px solid var(--border)', borderRadius: 10, padding: '16px', display: 'flex', alignItems: 'flex-end', gap: 6, height: 80 }}>
            {runningPnL.map((val, i) => {
              const h = (Math.abs(val) / maxPnL) * 60 + 4
              return (
                <div key={i} title={`Bet ${i + 1}: ${val >= 0 ? '+' : ''}$${val}`} style={{ flex: 1, height: h, background: val >= 0 ? '#00C853' : '#f85149', borderRadius: '3px 3px 0 0', opacity: 0.85, cursor: 'pointer', minWidth: 6 }} />
              )
            })}
          </div>
        </div>
      )}

      {/* Add bet */}
      <div style={{ background: 'var(--bg2)', border: '1px solid var(--border)', borderRadius: 10, padding: '14px 16px', marginBottom: 16 }}>
        <Label>Add a Bet</Label>
        <div className="calc-tracker-add" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(120px,1fr))', gap: 8, alignItems: 'flex-end' }}>
          <input value={newBet.game} onChange={e => setNewBet({ ...newBet, game: e.target.value })} placeholder="Game (e.g. Chiefs vs Ravens)"
            style={{ background: 'var(--bg3)', border: '1px solid var(--border)', borderRadius: 7, padding: '9px 12px', fontSize: 13, color: 'var(--text)', outline: 'none', fontFamily: 'inherit' }} />
          <input value={newBet.odds} onChange={e => setNewBet({ ...newBet, odds: e.target.value })} placeholder="Odds (-110)"
            style={{ background: 'var(--bg3)', border: '1px solid var(--border)', borderRadius: 7, padding: '9px 12px', fontSize: 13, color: 'var(--text)', outline: 'none', fontFamily: 'inherit' }} />
          <input value={newBet.stake} onChange={e => setNewBet({ ...newBet, stake: e.target.value })} placeholder="Stake ($)"
            style={{ background: 'var(--bg3)', border: '1px solid var(--border)', borderRadius: 7, padding: '9px 12px', fontSize: 13, color: 'var(--text)', outline: 'none', fontFamily: 'inherit' }} />
          <button onClick={addBet} style={{ background: '#00C853', color: '#000', border: 'none', borderRadius: 7, padding: '9px 16px', fontSize: 13, fontWeight: 800, cursor: 'pointer', fontFamily: 'inherit', whiteSpace: 'nowrap' }}>+ Add</button>
        </div>
      </div>

      {/* Bet list */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        {profitByBet.map(b => (
          <div key={b.id} className="calc-bet-row" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(90px,1fr))', gap: 8, alignItems: 'center', background: 'var(--bg2)', border: '1px solid var(--border)', borderRadius: 9, padding: '10px 14px' }}>
            <div style={{ fontSize: 13, fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{b.game}</div>
            <div style={{ fontWeight: 700, fontSize: 13, color: +b.odds > 0 ? '#00C853' : '#f85149' }}>{b.odds}</div>
            <div style={{ fontSize: 13 }}>${b.stake}</div>
            <div>
              <select value={b.result} onChange={e => setResult(b.id, e.target.value)}
                style={{ background: b.result === 'win' ? 'rgba(0,200,83,0.12)' : b.result === 'loss' ? 'rgba(248,81,73,0.1)' : 'rgba(240,165,0,0.1)', color: b.result === 'win' ? '#00C853' : b.result === 'loss' ? '#f85149' : '#f0a500', border: 'none', borderRadius: 20, padding: '4px 10px', fontSize: 11, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit', width: '100%' }}>
                <option value="pending">Pending</option>
                <option value="win">Win</option>
                <option value="loss">Loss</option>
              </select>
            </div>
            <div style={{ fontWeight: 700, fontSize: 13, textAlign: 'right', color: b.profit > 0 ? '#00C853' : b.profit < 0 ? '#f85149' : 'var(--dim)' }}>
              {b.result === 'pending' ? '—' : `${b.profit >= 0 ? '+' : ''}$${b.profit}`}
            </div>
            <button onClick={() => removeBet(b.id)} style={{ background: 'none', border: 'none', color: 'var(--border2)', cursor: 'pointer', fontSize: 16 }}>×</button>
          </div>
        ))}
      </div>
    </SectionCard>
  )
}

// ─── Odds Converter ────────────────────────────────────────────────────────
function OddsConverter() {
  const [american, setAmerican] = useState('110')
  const [sign, setSign] = useState<'+' | '-'>('-')

  const fullAmerican = sign === '+' ? +american : -(+american)
  const dec = isNaN(fullAmerican) || fullAmerican === 0 ? null : americanToDecimal(fullAmerican)
  const impl = dec ? (1 / dec * 100).toFixed(2) : null
  const decStr = dec ? dec.toFixed(4) : null
  const fracN = dec ? Math.round((dec - 1) * 100) : null
  const fracD = 100

  return (
    <SectionCard icon="🔄" title="Odds Converter" subtitle="Convert between American, Decimal, Fractional, and Implied Probability">
      <div>
        <Label>American Odds</Label>
        <div style={{ display: 'flex', gap: 0, marginBottom: 16 }}>
          {(['+', '-'] as const).map(s => (
            <button key={s} onClick={() => setSign(s)} style={{ padding: '10px 20px', background: sign === s ? '#00C853' : 'var(--bg2)', color: sign === s ? '#000' : 'var(--muted)', border: '1px solid var(--border)', cursor: 'pointer', fontWeight: 800, fontSize: 18, fontFamily: 'inherit', borderRadius: s === '+' ? '8px 0 0 8px' : '0 8px 8px 0' }}>{s}</button>
          ))}
          <input type="number" value={american} onChange={e => setAmerican(e.target.value)} min="100"
            style={{ flex: 1, background: 'var(--bg2)', border: '1px solid var(--border)', borderLeft: 'none', borderRadius: '0 8px 8px 0', padding: '10px 14px', fontSize: 18, color: 'var(--text)', outline: 'none', fontFamily: 'inherit', fontWeight: 700 }} />
        </div>
      </div>
      {dec && (
        <div className="calc-4col" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(120px,1fr))', gap: 10 }}>
          <ResultBox label="American" value={`${sign}${american}`} color="var(--text)" />
          <ResultBox label="Decimal" value={decStr!} color="#58a6ff" />
          <ResultBox label="Fractional" value={`${fracN}/${fracD}`} color="#8957e5" />
          <ResultBox label="Implied Prob" value={`${impl}%`} color="#f0a500" />
        </div>
      )}
    </SectionCard>
  )
}

// ─── PAGE ─────────────────────────────────────────────────────────────────
export default function CalculatorsPage() {
  const [activeTab, setActiveTab] = useState<'arb' | 'ev' | 'tracker' | 'converter'>('arb')

  const TABS = [
    { id: 'arb',       label: '⚡ Arbitrage',    desc: 'Guaranteed profit' },
    { id: 'ev',        label: '📈 Positive EV',  desc: 'Expected value' },
    { id: 'tracker',   label: '📊 Bet Tracker',  desc: 'P&L + ROI + CLV' },
    { id: 'converter', label: '🔄 Odds Converter', desc: 'All formats' },
  ] as const

  return (
    <div style={{ padding: 'clamp(14px,4vw,24px)', maxWidth: 860, margin: '0 auto' }}>
      <style>{`@media(max-width:480px){.calc-tracker-add{grid-template-columns:1fr 1fr!important;}.calc-bet-row{grid-template-columns:1fr 1fr!important;}.calc-4col{grid-template-columns:1fr 1fr!important;}}
        @keyframes spin { to { transform:rotate(360deg) } }
        @media (max-width: 768px) {
          .calc-tabs-row { flex-wrap: nowrap !important; overflow-x: auto !important; scrollbar-width: none !important; padding-bottom: 4px !important; -webkit-overflow-scrolling: touch !important; }
          .calc-tabs-row::-webkit-scrollbar { display: none !important; }
          .calc-tabs-row button { flex-shrink: 0 !important; font-size: 11px !important; padding: 6px 10px !important; }
          .calc-2col  { grid-template-columns: 1fr !important; }
          .calc-4col  { grid-template-columns: 1fr 1fr !important; }
          .calc-3col  { grid-template-columns: 1fr !important; }
          .calc-card-body  { padding: 14px !important; }
          .calc-card-header { padding: 14px 16px !important; }
          .calc-tracker-add { grid-template-columns: 1fr 1fr !important; gap: 6px !important; }
          .calc-bet-row { overflow-x: auto !important; font-size: 11px !important; }
          .calc-converter { grid-template-columns: 1fr 1fr !important; }
        }
      `}</style>
      {/* Header */}
      <div style={{ marginBottom: 24 }}>
        <h1 style={{ fontSize: 22, fontWeight: 900, marginBottom: 4 }}>🧮 Betting Calculators</h1>
        <p style={{ color: 'var(--muted)', fontSize: 13 }}>All the math you need — arbitrage, expected value, P&L tracking, and odds conversion.</p>
      </div>

      {/* Tab bar */}
      <div className="calc-tabs-row" style={{ display: 'flex', gap: 8, marginBottom: 24, flexWrap: 'wrap' }}>
        {TABS.map(t => (
          <button
            key={t.id}
            onClick={() => setActiveTab(t.id)}
            style={{
              padding: '10px 18px', borderRadius: 10, border: `1px solid ${activeTab === t.id ? '#00C853' : 'var(--bg4)'}`,
              background: activeTab === t.id ? 'rgba(0,200,83,0.1)' : 'var(--bg3)',
              color: activeTab === t.id ? '#00C853' : 'var(--muted)',
              fontWeight: activeTab === t.id ? 700 : 400, cursor: 'pointer', fontFamily: 'inherit',
              display: 'flex', flexDirection: 'column', gap: 2, textAlign: 'left' as const,
            }}
          >
            <span style={{ fontSize: 13 }}>{t.label}</span>
            <span style={{ fontSize: 10, opacity: 0.7 }}>{t.desc}</span>
          </button>
        ))}
      </div>

      {activeTab === 'arb'       && <ArbCalculator />}
      {activeTab === 'ev'        && <EVCalculator />}
      {activeTab === 'tracker'   && <BetTrackerCalculator />}
      {activeTab === 'converter' && <OddsConverter />}
    </div>
  )
}
