const router        = require('express').Router()
const { protect, adminOnly } = require('../middleware/auth')
const AffiliateLink = require('../models/AffiliateLink')

const DEFAULT_BOOKS = [
  // ── USA ────────────────────────────────────────────────────────────────
  { sportsbook_id:'fanduel',     displayName:'FanDuel',          baseUrl:'https://sportsbook.fanduel.com',        affiliateUrl:'https://sportsbook.fanduel.com',        logoColor:'#1493ff', markets:['US'] },
  { sportsbook_id:'draftkings',  displayName:'DraftKings',       baseUrl:'https://sportsbook.draftkings.com',     affiliateUrl:'https://sportsbook.draftkings.com',     logoColor:'#53d337', markets:['US'] },
  { sportsbook_id:'betmgm',      displayName:'BetMGM',           baseUrl:'https://sports.betmgm.com',             affiliateUrl:'https://sports.betmgm.com',             logoColor:'#d4af37', markets:['US'] },
  { sportsbook_id:'bet365_us',   displayName:'Bet365 (US)',      baseUrl:'https://www.bet365.com',                affiliateUrl:'https://www.bet365.com',                logoColor:'#028a0f', markets:['US'] },
  { sportsbook_id:'caesars',     displayName:'Caesars',          baseUrl:'https://sportsbook.caesars.com',        affiliateUrl:'https://sportsbook.caesars.com',        logoColor:'#0047ab', markets:['US'] },
  { sportsbook_id:'fanatics',    displayName:'Fanatics Sportsbook',baseUrl:'https://sportsbook.fanatics.com',     affiliateUrl:'https://sportsbook.fanatics.com',       logoColor:'#cc0000', markets:['US'] },
  { sportsbook_id:'betrivers',   displayName:'BetRivers',        baseUrl:'https://www.betrivers.com',             affiliateUrl:'https://www.betrivers.com',             logoColor:'#e30613', markets:['US'] },
  { sportsbook_id:'hardrock',    displayName:'Hard Rock Bet',    baseUrl:'https://www.hardrock.bet',              affiliateUrl:'https://www.hardrock.bet',              logoColor:'#b8860b', markets:['US'] },
  { sportsbook_id:'espnbet',     displayName:'ESPN Bet',         baseUrl:'https://espnbet.com',                   affiliateUrl:'https://espnbet.com',                   logoColor:'#cc0000', markets:['US'] },
  { sportsbook_id:'pinnacle_us', displayName:'Pinnacle (US)',    baseUrl:'https://www.pinnacle.com',              affiliateUrl:'https://www.pinnacle.com',              logoColor:'#ffcc00', markets:['US'] },
  { sportsbook_id:'pointsbet_us',displayName:'PointsBet (US)',   baseUrl:'https://pointsbet.com',                 affiliateUrl:'https://pointsbet.com',                 logoColor:'#ff6600', markets:['US'] },
  { sportsbook_id:'unibet_us',   displayName:'Unibet (US)',      baseUrl:'https://www.unibet.com',                affiliateUrl:'https://www.unibet.com',                logoColor:'#147b45', markets:['US'] },
  { sportsbook_id:'williamhill', displayName:'William Hill',     baseUrl:'https://www.williamhill.com',           affiliateUrl:'https://www.williamhill.com',           logoColor:'#7b1fa2', markets:['US'] },
  { sportsbook_id:'barstool',    displayName:'Barstool',         baseUrl:'https://www.barstoolsportsbook.com',    affiliateUrl:'https://www.barstoolsportsbook.com',    logoColor:'#1a1a1a', markets:['US'] },
  { sportsbook_id:'bovada',      displayName:'Bovada',           baseUrl:'https://www.bovada.lv',                 affiliateUrl:'https://www.bovada.lv',                 logoColor:'#e53935', markets:['US'] },
  // ── CANADA ────────────────────────────────────────────────────────────
  { sportsbook_id:'tooniebet',   displayName:'ToonieBet',        baseUrl:'https://www.tooniebet.com',             affiliateUrl:'https://www.tooniebet.com',             logoColor:'#e6b800', markets:['CA'] },
  { sportsbook_id:'bet365_ca',   displayName:'Bet365 (CA)',      baseUrl:'https://www.bet365.com',                affiliateUrl:'https://www.bet365.com',                logoColor:'#028a0f', markets:['CA'] },
  { sportsbook_id:'draftkings_ca',displayName:'DraftKings (CA)', baseUrl:'https://sportsbook.draftkings.com',     affiliateUrl:'https://sportsbook.draftkings.com',     logoColor:'#53d337', markets:['CA'] },
  { sportsbook_id:'fanduel_ca',  displayName:'FanDuel (CA)',     baseUrl:'https://sportsbook.fanduel.com',        affiliateUrl:'https://sportsbook.fanduel.com',        logoColor:'#1493ff', markets:['CA'] },
  { sportsbook_id:'betmgm_ca',   displayName:'BetMGM (CA)',      baseUrl:'https://sports.betmgm.com',             affiliateUrl:'https://sports.betmgm.com',             logoColor:'#d4af37', markets:['CA'] },
  { sportsbook_id:'si',          displayName:'Sports Interaction',baseUrl:'https://www.sportsinteraction.com',    affiliateUrl:'https://www.sportsinteraction.com',     logoColor:'#1a73e8', markets:['CA'] },
  { sportsbook_id:'pointsbet_ca',displayName:'PointsBet (CA)',   baseUrl:'https://pointsbet.ca',                  affiliateUrl:'https://pointsbet.ca',                  logoColor:'#ff6600', markets:['CA'] },
  { sportsbook_id:'pinnacle',    displayName:'Pinnacle',         baseUrl:'https://www.pinnacle.com',              affiliateUrl:'https://www.pinnacle.com',              logoColor:'#ffcc00', markets:['CA'] },
  { sportsbook_id:'playnow',     displayName:'PlayNow.com',      baseUrl:'https://www.playnow.com',               affiliateUrl:'https://www.playnow.com',               logoColor:'#005baa', markets:['CA'] },
  { sportsbook_id:'tonybet',     displayName:'TonyBet',          baseUrl:'https://www.tonybet.com',               affiliateUrl:'https://www.tonybet.com',               logoColor:'#e63946', markets:['CA'] },
  { sportsbook_id:'unibet_ca',   displayName:'Unibet (CA)',      baseUrl:'https://www.unibet.ca',                 affiliateUrl:'https://www.unibet.ca',                 logoColor:'#147b45', markets:['CA'] },
]

async function seedDefaults() {
  try {
    for (const book of DEFAULT_BOOKS) {
      const exists = await AffiliateLink.findOne({ sportsbook_id: book.sportsbook_id })
      if (!exists) {
        await AffiliateLink.create(book)
        console.log(`[Affiliates] Added: ${book.displayName}`)
      }
    }
  } catch (err) {
    console.warn('[Affiliates] Seed error:', err.message)
  }
}
seedDefaults()

function buildUrl(affiliateUrl, sportsbook_id, source) {
  try {
    const url = new URL(affiliateUrl)
    url.searchParams.set('utm_source',   'trueodds')
    url.searchParams.set('utm_medium',   source || 'platform')
    url.searchParams.set('utm_campaign', sportsbook_id)
    return url.toString()
  } catch {
    return affiliateUrl
  }
}

router.get('/public', async (req, res) => {
  try {
    const { market } = req.query
    const filter = { active: true }
    if (market) filter.markets = market
    const books = await AffiliateLink.find(filter).select('-__v')
    const result = {}
    books.forEach(b => {
      result[b.sportsbook_id] = {
        displayName:  b.displayName,
        url:          buildUrl(b.affiliateUrl, b.sportsbook_id, req.query.source || 'platform'),
        baseUrl:      b.baseUrl,
        logoColor:    b.logoColor,
        markets:      b.markets,
      }
    })
    res.json({ success: true, books: result })
  } catch (err) {
    res.status(500).json({ success: false, message: err.message })
  }
})

router.post('/click/:sportsbook', async (req, res) => {
  try {
    const { sportsbook } = req.params
    const { source } = req.body
    const book = await AffiliateLink.findOne({ sportsbook_id: sportsbook.toLowerCase() })
    if (!book) return res.status(404).json({ success: false, message: 'Sportsbook not found.' })
    book.clicks     += 1
    book.lastClickAt = new Date()
    await book.save()
    const url = buildUrl(book.affiliateUrl, book.sportsbook_id, source || 'platform')
    res.json({ success: true, url })
  } catch (err) {
    res.status(500).json({ success: false, message: err.message })
  }
})

router.get('/', protect, adminOnly, async (req, res) => {
  try {
    const books = await AffiliateLink.find({}).sort({ clicks: -1 })
    res.json({ success: true, books })
  } catch (err) {
    res.status(500).json({ success: false, message: err.message })
  }
})

router.post('/', protect, adminOnly, async (req, res) => {
  try {
    const book = await AffiliateLink.create(req.body)
    res.json({ success: true, book })
  } catch (err) {
    res.status(400).json({ success: false, message: err.message })
  }
})

router.put('/:id', protect, adminOnly, async (req, res) => {
  try {
    const book = await AffiliateLink.findByIdAndUpdate(
      req.params.id,
      { ...req.body, updatedAt: new Date() },
      { new: true, runValidators: true }
    )
    if (!book) return res.status(404).json({ success: false, message: 'Not found.' })
    res.json({ success: true, book })
  } catch (err) {
    res.status(400).json({ success: false, message: err.message })
  }
})

router.delete('/:id', protect, adminOnly, async (req, res) => {
  try {
    await AffiliateLink.findByIdAndDelete(req.params.id)
    res.json({ success: true })
  } catch (err) {
    res.status(500).json({ success: false, message: err.message })
  }
})

module.exports = router
