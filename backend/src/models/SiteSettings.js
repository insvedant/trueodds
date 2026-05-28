const mongoose = require('mongoose')

const siteSettingsSchema = new mongoose.Schema({
  key:   { type: String, required: true, unique: true },
  value: { type: mongoose.Schema.Types.Mixed, default: null },
  updatedAt: { type: Date, default: Date.now },
})

const SiteSettings = mongoose.model('SiteSettings', siteSettingsSchema)

async function getSetting(key, fallback = null) {
  try {
    const doc = await SiteSettings.findOne({ key })
    return doc ? doc.value : fallback
  } catch { return fallback }
}

async function setSetting(key, value) {
  await SiteSettings.findOneAndUpdate(
    { key },
    { key, value, updatedAt: new Date() },
    { upsert: true, new: true }
  )
}

async function getAllSettings() {
  const docs = await SiteSettings.find({})
  return Object.fromEntries(docs.map(d => [d.key, d.value]))
}

module.exports = { SiteSettings, getSetting, setSetting, getAllSettings }
