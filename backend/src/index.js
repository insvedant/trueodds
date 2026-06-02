require('dotenv').config()
const express   = require('express')
const cors      = require('cors')
const mongoose  = require('mongoose')
const http      = require('http')
const { Server }= require('socket.io')
const rateLimit = require('express-rate-limit')

function getAllowedOrigins() {
  const base = [
    'http://localhost:3000',
    'http://localhost:4000',
  ]
  const fe = process.env.FRONTEND_URL
  if (fe) {
    base.push(fe)
    
    if (fe.includes('://www.')) base.push(fe.replace('://www.', '://'))
    else base.push(fe.replace('://', '://www.'))
  }
  
  base.push('https://trueodds.ca', 'https://www.trueodds.ca')
  return base
}

const app    = express()
const server = http.createServer(app)
const io     = new Server(server, {
  cors: { origin: getAllowedOrigins(), methods: ['GET','POST'], credentials: true }
})

app.use('/api/webhook/stripe',
  express.raw({ type: 'application/json' }),
  require('./routes/webhook')
)

app.use(cors({ origin: getAllowedOrigins(), credentials: true }))
app.use(express.json({ limit: '10kb' }))
app.use(express.urlencoded({ extended: true }))

app.use('/api/', rateLimit({ windowMs: 15 * 60 * 1000, max: 500, message: { success: false, message: 'Too many requests.' } }))
app.use('/api/auth/login', rateLimit({ windowMs: 15 * 60 * 1000, max: 30, message: { success: false, message: 'Too many login attempts. Please wait 15 minutes.' } }))
app.use('/api/auth/', rateLimit({ windowMs: 15 * 60 * 1000, max: 100 }))

app.get('/health', (req, res) => res.json({
  status:   'ok',
  env:      process.env.NODE_ENV || 'development',
  db:       mongoose.connection.readyState === 1 ? 'connected' : 'disconnected',
  stripe:   process.env.STRIPE_SECRET_KEY?.startsWith('sk_') ? 'configured' : 'missing',
  zoho:     (process.env.ZOHO_USER && process.env.ZOHO_PASSWORD) ? 'configured' : 'missing',
  telegram: (process.env.TELEGRAM_BOT_TOKEN && process.env.TELEGRAM_CHAT_ID) ? 'configured' : 'missing',
  stripeBasic:    (process.env.STRIPE_PRICE_BASIC_MONTHLY || process.env.STRIPE_PRICE_BASIC)    ? 'set' : 'missing',
  stripeGold:     (process.env.STRIPE_PRICE_GOLD_MONTHLY  || process.env.STRIPE_PRICE_GOLD)     ? 'set' : 'missing',
  stripePlatinum: (process.env.STRIPE_PRICE_PLATINUM_MONTHLY || process.env.STRIPE_PRICE_PLATINUM) ? 'set' : 'missing',
}))

app.use('/api/auth',          require('./routes/auth'))
app.use('/api/subscriptions', require('./routes/subscriptions'))
app.use('/api/hedge',         require('./routes/hedge'))
app.use('/api/referral',      require('./routes/referral'))
app.use('/api/chat',          require('./routes/chat'))
app.use('/api/telegram',      require('./routes/telegram'))
app.use('/api/settings',      require('./routes/settings'))
app.use('/api/affiliates',    require('./routes/affiliates'))
app.use('/api/blog',          require('./routes/blog'))
app.use('/uploads',           require('express').static(require('path').join(__dirname, '../uploads')))
app.use('/api',               require('./routes/odds'))
app.use('/api/bets',          require('./routes/bets'))
app.use('/api/alerts',        require('./routes/alerts'))
app.use('/api/admin',         require('./routes/admin'))
app.use('/api/analytics',     require('./routes/analytics'))
app.use('/api/ml',            require('./routes/ml'))

app.use((req, res) =>
  res.status(404).json({ success: false, message: `Route ${req.method} ${req.path} not found.` })
)
app.use((err, req, res, next) => {
  console.error(err)
  res.status(500).json({ success: false, message: 'Internal server error.' })
})

io.on('connection', socket => {
  
  const interval = setInterval(() => {
    socket.emit('odds_update', { timestamp: new Date() })
  }, 10000)
  socket.on('disconnect', () => clearInterval(interval))
})

const chatIo = io.of('/chat')
require('./services/chatSocket')(chatIo)

const PORT = process.env.PORT || 4000

server.listen(PORT, '0.0.0.0', () => {
  console.log(`🚀 TrueOdds backend running on port ${PORT}`)
  const hasStripe = process.env.STRIPE_SECRET_KEY?.startsWith('sk_')
  console.log(`💳 Stripe: ${hasStripe ? '✅ Configured' : '⚠️  Add STRIPE_SECRET_KEY'}`)

  
  const { registerWebhook } = require('./services/telegramService')
  registerWebhook().catch(() => {})
})

mongoose.connect(process.env.MONGODB_URI)
  .then(() => {
    console.log('✅ MongoDB connected')
  })
  .catch(err => {
    console.error('❌ MongoDB error:', err.message)
    
  })
