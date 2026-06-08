const router = require('express').Router()
const { protect, adminOnly } = require('../middleware/auth')
const { getSetting, setSetting, getAllSettings } = require('../models/SiteSettings')

const DEFAULTS = {
  instagram: '',
  twitter:   '',
  discord:   '',
  facebook:  '',
  pinterest: '',
}

router.get('/public', async (req, res) => {
  try {
    const all = await getAllSettings()
    const social = {
      instagram: all.instagram || '',
      twitter:   all.twitter   || '',
      discord:   all.discord   || '',
      facebook:  all.facebook  || '',
      pinterest: all.pinterest || '',
    }
    res.json({ success: true, social })
  } catch (err) {
    res.json({ success: true, social: DEFAULTS })
  }
})

router.get('/', protect, adminOnly, async (req, res) => {
  try {
    const all = await getAllSettings()
    res.json({ success: true, settings: { ...DEFAULTS, ...all } })
  } catch (err) {
    res.status(500).json({ success: false, message: err.message })
  }
})

router.put('/', protect, adminOnly, async (req, res) => {
  try {
    const allowed = ['instagram', 'twitter', 'discord', 'facebook', 'pinterest']
    for (const key of allowed) {
      if (req.body[key] !== undefined) {
        await setSetting(key, req.body[key])
      }
    }
    const all = await getAllSettings()
    res.json({ success: true, message: 'Settings saved.', settings: { ...DEFAULTS, ...all } })
  } catch (err) {
    res.status(500).json({ success: false, message: err.message })
  }
})

module.exports = router
