'use client'
import { createContext, useContext, useState, useEffect, ReactNode } from 'react'
import { getMarketFromStorage, getAvailableSportsbooks, detectMarket, saveMarketToStorage } from './geo'
import type { Market } from './geo'

interface GeoCtx {
  market: Market
  state: string
  regionalBooks: string[]
  selectedBooks: string[]
  setSelectedBooks: (books: string[]) => void
  allBooks: string[]
  liveBooks: string[]
  setLiveBooks: (books: string[]) => void
  bookFreq: Record<string, number>
  setBookFreq: (freq: Record<string, number>) => void
}

const Ctx = createContext<GeoCtx>({
  market: 'US', state: 'NY',
  regionalBooks: [], selectedBooks: [], allBooks: [], liveBooks: [],
  bookFreq: {},
  setSelectedBooks: () => {},
  setLiveBooks: () => {},
  setBookFreq: () => {},
})

export function GeoProvider({ children }: { children: ReactNode }) {
  const [market, setMarket]               = useState<Market>('US')
  const [state, setState]                 = useState('NY')
  const [regionalBooks, setRegionalBooks] = useState<string[]>([])
  const [selectedBooks, setSelectedBooks] = useState<string[]>([])
  const [liveBooks, setLiveBooks]         = useState<string[]>([])
  const [bookFreq, setBookFreq]           = useState<Record<string, number>>({})

  const ALL_US_BOOKS = ['fanduel','draftkings','betmgm','caesars','betrivers','espnbet','hardrockbet','pointsbet','fanatics','unibet','barstool','pinnacle','bet365','williamhill','bovada']
  const ALL_CA_BOOKS = ['bet365','draftkings','fanduel','betmgm','sports_interaction','pointsbet','pinnacle','tooniebet','tonybet','unibet','playnow']

  useEffect(() => {
    const saved = getMarketFromStorage()
    if (saved) {
      setMarket(saved.market)
      setState(saved.state)
      const books = getAvailableSportsbooks(saved.state)
      setRegionalBooks(books)
      // Don't pre-select — user chooses which books to filter by
      setSelectedBooks([])
    } else {
      // Auto-detect
      detectMarket().then(({ market: m, countryCode }) => {
        const st = countryCode === 'CA' ? 'ON' : 'NY'
        setMarket(m); setState(st)
        const books = getAvailableSportsbooks(st)
        setRegionalBooks(books)
        setSelectedBooks([])
        saveMarketToStorage(m, st)
      })
    }
  }, [])

  // Re-read on storage change (StateSelector updates it)
  useEffect(() => {
    const handle = () => {
      const saved = getMarketFromStorage()
      if (saved) {
        setMarket(saved.market); setState(saved.state)
        setRegionalBooks(getAvailableSportsbooks(saved.state))
        setSelectedBooks([])
      }
    }
    window.addEventListener('storage', handle)
    window.addEventListener('trueodds:marketchange', handle)
    return () => { window.removeEventListener('storage', handle); window.removeEventListener('trueodds:marketchange', handle) }
  }, [])

  const allBooks = market === 'CA' ? ALL_CA_BOOKS : ALL_US_BOOKS

  return (
    <Ctx.Provider value={{ market, state, regionalBooks, selectedBooks, setSelectedBooks, allBooks, liveBooks, setLiveBooks, bookFreq, setBookFreq }}>
      {children}
    </Ctx.Provider>
  )
}

export function useGeo() { return useContext(Ctx) }
