require('dotenv').config()
const express   = require('express')
const cors      = require('cors')
const mongoose  = require('mongoose')
const http      = require('http')
const { Server }= require('socket.io')
const rateLimit = require('express-rate-limit')

// Build allowed origins list from env + hardcoded www variants
function getAllowedOrigins() {
  const base = [
    'http://localhost:3000',
    'http://localhost:4000',
  ]
  const fe = process.env.FRONTEND_URL
  if (fe) {
    base.push(fe)
    // Always add both www and non-www variants
    if (fe.includes('://www.')) base.push(fe.replace('://www.', '://'))
    else base.push(fe.replace('://', '://www.'))
  }
  // Always include both versions of trueodds.ca
  base.push('https://trueodds.ca', 'https://www.trueodds.ca')
  return base
}

const app    = express()
const server = http.createServer(app)
const io     = new Server(server, {
  cors: { origin: getAllowedOrigins(), methods: ['GET','POST'], credentials: true }
})

// ── IMPORTANT: Stripe webhook needs raw body for signature verification ──
// Mount BEFORE express.json()
app.use('/api/webhook/stripe',
  express.raw({ type: 'application/json' }),
  require('./routes/webhook')
)

// ── Regular middleware ────────────────────────────────────────────────────
app.use(cors({ origin: getAllowedOrigins(), credentials: true }))
app.use(express.json({ limit: '10kb' }))
app.use(express.urlencoded({ extended: true }))

// Rate limiting
app.use('/api/', rateLimit({ windowMs: 15 * 60 * 1000, max: 300, message: { success: false, message: 'Too many requests.' } }))
app.use('/api/auth/', rateLimit({ windowMs: 15 * 60 * 1000, max: 20 }))

// ── Routes ────────────────────────────────────────────────────────────────
app.get('/health', (req, res) => res.json({
  status: 'ok',
  env: process.env.NODE_ENV || 'development',
  db: mongoose.connection.readyState === 1 ? 'connected' : 'disconnected',
  stripe: process.env.STRIPE_SECRET_KEY?.startsWith('sk_') ? 'configured' : 'demo_mode',
}))

app.use('/api/auth',          require('./routes/auth'))
app.use('/api/subscriptions', require('./routes/subscriptions'))
app.use('/api/hedge',         require('./routes/hedge'))
app.use('/api/referral',      require('./routes/referral'))
app.use('/api/chat',          require('./routes/chat'))
app.use('/api/telegram',      require('./routes/telegram'))
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

// ── Socket.io — live odds push + chat ──────────────────────────────────────
io.on('connection', socket => {
  // Live odds updates (existing functionality)
  const interval = setInterval(() => {
    socket.emit('odds_update', { timestamp: new Date() })
  }, 10000)
  socket.on('disconnect', () => clearInterval(interval))
})

// Chat socket (separate namespace to avoid conflicts)
const chatIo = io.of('/chat')
require('./services/chatSocket')(chatIo)

// ── DB + Start ─────────────────────────────────────────────────────────────
const PORT = process.env.PORT || 4000

// Start listening FIRST so Render sees an open port immediately
server.listen(PORT, '0.0.0.0', () => {
  console.log(`🚀 TrueOdds backend running on port ${PORT}`)
  const hasStripe = process.env.STRIPE_SECRET_KEY?.startsWith('sk_')
  console.log(`💳 Stripe: ${hasStripe ? '✅ Configured' : '⚠️  Add STRIPE_SECRET_KEY'}`)

  // Auto-register Telegram webhook on startup
  const { registerWebhook } = require('./services/telegramService')
  registerWebhook().catch(() => {})
})

// Connect MongoDB after server is already listening
mongoose.connect(process.env.MONGODB_URI)
  .then(() => {
    console.log('✅ MongoDB connected')
  })
  .catch(err => {
    console.error('❌ MongoDB error:', err.message)
    // Do NOT exit — keep server running so Render does not mark as failed
  })
