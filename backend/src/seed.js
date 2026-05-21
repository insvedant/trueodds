require('dotenv').config()
const mongoose = require('mongoose')
const User = require('./models/User')
const Bet = require('./models/Bet')

const USERS = [
  { name: 'Admin User', email: 'admin@trueodds.com', password: 'admin123', role: 'admin', plan: 'platinum', subscriptionStatus: 'active', totalPaid: 597, payments: [{ amount: 149, plan: 'platinum', status: 'completed' }, { amount: 149, plan: 'platinum', status: 'completed' }, { amount: 149, plan: 'platinum', status: 'completed' }, { amount: 150, plan: 'platinum', status: 'completed' }] },
  { name: 'Test User', email: 'test@trueodds.com', password: 'password123', role: 'user', plan: 'gold', subscriptionStatus: 'active', totalPaid: 245, payments: [{ amount: 49, plan: 'gold', status: 'completed' }, { amount: 49, plan: 'gold', status: 'completed' }, { amount: 49, plan: 'gold', status: 'completed' }, { amount: 98, plan: 'gold', status: 'completed' }] },
  { name: 'John Smith', email: 'john@test.com', password: 'password123', role: 'user', plan: 'gold', subscriptionStatus: 'active', totalPaid: 147, payments: [{ amount: 49, plan: 'gold', status: 'completed' }, { amount: 49, plan: 'gold', status: 'completed' }, { amount: 49, plan: 'gold', status: 'completed' }] },
  { name: 'Sarah Johnson', email: 'sarah@test.com', password: 'password123', role: 'user', plan: 'platinum', subscriptionStatus: 'active', totalPaid: 448, payments: [{ amount: 149, plan: 'platinum', status: 'completed' }, { amount: 149, plan: 'platinum', status: 'completed' }, { amount: 150, plan: 'platinum', status: 'completed' }] },
  { name: 'Mike Williams', email: 'mike@test.com', password: 'password123', role: 'user', plan: 'free', subscriptionStatus: 'trial', totalPaid: 0 },
]

const GAME_TEMPLATES = [
  { game: 'Kansas City Chiefs vs Baltimore Ravens', sport: 'NFL', market: 'Chiefs ML' },
  { game: 'Los Angeles Lakers vs Boston Celtics', sport: 'NBA', market: 'Celtics -4.5' },
  { game: 'New York Yankees vs Boston Red Sox', sport: 'MLB', market: 'Over 8.5' },
  { game: 'Jon Jones vs Stipe Miocic', sport: 'UFC', market: 'Jones ML' },
  { game: 'Manchester City vs Arsenal', sport: 'Soccer', market: 'Man City ML' },
  { game: 'Toronto Maple Leafs vs Montreal Canadiens', sport: 'NHL', market: 'Over 5.5' },
  { game: 'Novak Djokovic vs Carlos Alcaraz', sport: 'Tennis', market: 'Djokovic ML' },
  { game: 'Golden State Warriors vs Miami Heat', sport: 'NBA', market: 'Warriors ML' },
]
const BOOKS = ['DraftKings', 'FanDuel', 'BetMGM', 'Caesars', 'Pinnacle', 'Bet365']
const RESULTS = ['win', 'win', 'win', 'loss', 'loss', 'pending']
const TYPES = ['standard', 'standard', 'standard', 'arbitrage', 'ev']

async function seed() {
  try {
    await mongoose.connect(process.env.MONGODB_URI)
    console.log('Connected to MongoDB:', process.env.MONGODB_URI)

    await User.deleteMany({}); await Bet.deleteMany({})
    console.log('Cleared existing data.')

    const createdUsers = []
    for (const u of USERS) {
      const created = await User.create({ ...u, trialEndsAt: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000), createdAt: new Date(Date.now() - Math.random() * 90 * 24 * 60 * 60 * 1000) })
      createdUsers.push(created)
      console.log(`✅ User: ${created.email} (${created.plan})`)
    }

    // Create bets for each non-admin user
    for (const user of createdUsers.filter(u => u.role !== 'admin')) {
      const count = user.plan === 'platinum' ? 20 : user.plan === 'gold' ? 12 : 3
      for (let i = 0; i < count; i++) {
        const tmpl = GAME_TEMPLATES[i % GAME_TEMPLATES.length]
        const result = RESULTS[Math.floor(Math.random() * RESULTS.length)]
        const odds = [-110, -115, -108, 105, 115, 120, 135, -130, -105][Math.floor(Math.random() * 9)]
        const stake = [50, 75, 100, 110, 125, 150, 200][Math.floor(Math.random() * 7)]
        await Bet.create({ user: user._id, ...tmpl, book: BOOKS[Math.floor(Math.random() * BOOKS.length)], odds, stake, result, betType: TYPES[Math.floor(Math.random() * TYPES.length)], date: new Date(Date.now() - Math.random() * 60 * 24 * 60 * 60 * 1000) })
      }
      console.log(`✅ Bets created for ${user.email}`)
    }

    console.log('\n🎉 Seed complete!\n')
    console.log('Login credentials:')
    USERS.forEach(u => console.log(`  ${u.email} / ${u.password}  (${u.role}, ${u.plan})`))
    process.exit(0)
  } catch (err) {
    console.error('❌ Seed error:', err.message)
    process.exit(1)
  }
}

seed()
