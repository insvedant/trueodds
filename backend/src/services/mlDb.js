/**
 * backend/src/services/mlDb.js
 *
 * IMPORTANT: backend/.env's MONGODB_URI points at the LOCAL Mongo instance on
 * this VM (mongodb://localhost:27017/trueodds) — that's where users, bets,
 * and subscriptions live, and it must never be touched by anything in here.
 *
 * ml/collect_data.py (the Python collector) writes odds_snapshots,
 * line_movements, and arb_history to a SEPARATE MongoDB Atlas cluster
 * (see ml/.env's MONGODB_URI). This file opens a second, independent
 * connection specifically to read that data, so Total Line Movement,
 * Steam Detection, and CLV can query real snapshot history without ever
 * touching the primary connection that holds user accounts and payments.
 *
 * Requires a new env var on the VM: ML_MONGODB_URI — set it to the exact
 * same value as ml/.env's MONGODB_URI.
 */

const mongoose = require('mongoose')

let mlConnection = null

function getMlConnection() {
  if (mlConnection) return mlConnection

  const uri = process.env.ML_MONGODB_URI
  if (!uri) {
    console.warn('[MLDB] ML_MONGODB_URI not set — Line Movement / Steam / CLV tools will return empty data until it is configured.')
    return null
  }

  mlConnection = mongoose.createConnection(uri, { serverSelectionTimeoutMS: 5000 })
  mlConnection.on('error', err => console.warn('[MLDB] connection error:', err.message))
  return mlConnection
}

// Reads directly from the 'trueodds' database on whichever cluster
// ML_MONGODB_URI points to — explicit db name, same defensive pattern
// already used in routes/ml.js, since the URI itself may or may not embed one.
function mlCollection(name) {
  const conn = getMlConnection()
  if (!conn) return null
  return conn.useDb('trueodds', { useCache: true }).collection(name)
}

module.exports = { getMlConnection, mlCollection }
