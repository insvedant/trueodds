/**
 * runAlerts.js — Called by GitHub Actions every 30 minutes
 * Connects to MongoDB, runs the alert scheduler, then exits.
 */
require('dotenv').config()
const mongoose              = require('mongoose')
const { runAlertScheduler } = require('../services/alertScheduler')

async function main() {
  console.log('[RunAlerts] Connecting to MongoDB...')
  await mongoose.connect(process.env.MONGODB_URI, { serverSelectionTimeoutMS: 15000 })
  console.log('[RunAlerts] Connected')
  const result = await runAlertScheduler()
  console.log('[RunAlerts] Result:', JSON.stringify(result))
  await mongoose.disconnect()
  process.exit(0)
}

main().catch(err => {
  console.error('[RunAlerts] Fatal:', err.message)
  process.exit(1)
})
