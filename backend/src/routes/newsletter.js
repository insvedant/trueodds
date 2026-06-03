const express  = require('express')
const router   = express.Router()
const User     = require('../models/User')
const { protect, adminOnly } = require('../middleware/auth')
const { sendEmail } = require('../services/emailService')

// POST /api/newsletter/send
router.post('/send', protect, adminOnly, async (req, res) => {
  try {
    const { subject, body, plans = ['basic','gold','platinum'], preview } = req.body

    if (!subject?.trim()) return res.status(400).json({ success:false, message:'Subject is required' })
    if (!body?.trim())    return res.status(400).json({ success:false, message:'Body is required' })

    // Fetch matching users with email
    const query = { email: { $exists:true, $ne:'' } }
    if (!plans.includes('all')) query.plan = { $in: plans }

    const users = await User.find(query).select('name email plan')

    if (preview) {
      return res.json({ success:true, preview:true, count: users.length, sample: users.slice(0,5).map(u=>({ name:u.name, email:u.email, plan:u.plan })) })
    }

    // Send emails in batches of 10 to avoid rate limits
    let sent = 0, failed = 0
    const BATCH = 10

    for (let i = 0; i < users.length; i += BATCH) {
      const batch = users.slice(i, i + BATCH)
      await Promise.allSettled(
        batch.map(user => {
          const html = buildEmailHtml({ subject, body, userName: user.name })
          return sendEmail({ to: user.email, subject, html, text: body })
            .then(() => sent++)
            .catch(() => failed++)
        })
      )
      // Small delay between batches
      if (i + BATCH < users.length) await new Promise(r => setTimeout(r, 500))
    }

    res.json({ success:true, sent, failed, total: users.length })
  } catch (err) {
    res.status(500).json({ success:false, message: err.message })
  }
})

// GET /api/newsletter/stats — preview recipient count per plan
router.get('/stats', protect, adminOnly, async (req, res) => {
  try {
    const [basic, gold, platinum] = await Promise.all([
      User.countDocuments({ plan:'basic',    email:{ $exists:true, $ne:'' } }),
      User.countDocuments({ plan:'gold',     email:{ $exists:true, $ne:'' } }),
      User.countDocuments({ plan:'platinum', email:{ $exists:true, $ne:'' } }),
    ])
    res.json({ success:true, data:{ basic, gold, platinum, total: basic+gold+platinum } })
  } catch (err) {
    res.status(500).json({ success:false, message: err.message })
  }
})

function buildEmailHtml({ subject, body, userName }) {
  const name = userName || 'there'
  const bodyHtml = body
    .split('\n')
    .map(line => line.trim() ? `<p style="margin:0 0 14px;color:#9ca3af;font-size:15px;line-height:1.7;">${line}</p>` : '<br/>')
    .join('')

  return `<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#080b12;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#080b12;padding:40px 20px;">
    <tr><td align="center">
      <table width="600" cellpadding="0" cellspacing="0" style="max-width:600px;width:100%;">
        <!-- Header -->
        <tr><td style="background:#0d1117;border-radius:16px 16px 0 0;padding:28px 32px;border-bottom:1px solid rgba(255,255,255,0.07);">
          <span style="font-size:22px;font-weight:900;color:#e6edf3;">True<span style="color:#00C853;">Odds</span></span>
          <span style="display:inline-block;margin-left:12px;background:rgba(0,200,83,0.1);color:#00C853;font-size:11px;font-weight:700;padding:3px 10px;border-radius:20px;">Newsletter</span>
        </td></tr>
        <!-- Body -->
        <tr><td style="background:#111520;padding:32px 32px 24px;border:1px solid rgba(255,255,255,0.06);border-top:none;">
          <p style="margin:0 0 20px;color:#e6edf3;font-size:18px;font-weight:700;">Hi ${name},</p>
          ${bodyHtml}
        </td></tr>
        <!-- CTA -->
        <tr><td style="background:#111520;padding:0 32px 32px;border:1px solid rgba(255,255,255,0.06);border-top:none;">
          <a href="https://trueodds.ca/dashboard" style="display:inline-block;background:#00C853;color:#000;font-weight:800;font-size:14px;padding:12px 28px;border-radius:10px;text-decoration:none;">Open Dashboard →</a>
        </td></tr>
        <!-- Footer -->
        <tr><td style="background:#0a0d15;border-radius:0 0 16px 16px;padding:20px 32px;border:1px solid rgba(255,255,255,0.06);border-top:none;">
          <p style="margin:0;font-size:12px;color:#4b5563;line-height:1.6;">
            You received this because you have a TrueOdds account.<br/>
            © 2026 TrueOdds · <a href="https://trueodds.ca" style="color:#6b7280;">trueodds.ca</a>
          </p>
        </td></tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`
}

module.exports = router
