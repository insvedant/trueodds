const nodemailer = require('nodemailer')

const FROM_NAME    = 'TrueOdds'
const FROM_ADDRESS = process.env.ZOHO_USER || 'support@trueodds.ca'

function createTransporter() {
  const user = process.env.ZOHO_USER
  const pass = process.env.ZOHO_PASSWORD

  if (!user || !pass) {
    console.warn('[Email] Zoho not configured — emails will be logged to console only')
    return null
  }

  return nodemailer.createTransport({
    host:   'smtp.zoho.com',
    port:   465,
    secure: true,
    auth:   { user, pass },
  })
}

async function sendEmail({ to, subject, html, text }) {
  const transporter = createTransporter()

  if (!transporter) {
    console.log('\n────────────────────────────────────')
    console.log('[Email DEV MODE — not sent]')
    console.log(`TO:      ${to}`)
    console.log(`SUBJECT: ${subject}`)
    console.log(`BODY:    ${text || html?.slice(0, 200)}`)
    console.log('────────────────────────────────────\n')
    return { success: true, devMode: true }
  }

  const info = await transporter.sendMail({
    from: `"${FROM_NAME}" <${FROM_ADDRESS}>`,
    to, subject, html, text,
  })

  console.log(`[Email] Sent to ${to} — MessageId: ${info.messageId}`)
  return { success: true, messageId: info.messageId }
}

async function sendPasswordResetEmail(email, name, resetToken) {
  const frontendUrl = process.env.FRONTEND_URL || 'https://trueodds.ca'
  const resetUrl    = `${frontendUrl}/reset-password?token=${resetToken}`

  const html = `
    <!DOCTYPE html><html><head><meta charset="utf-8">
    <style>
      body { font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif; background:#f8fafc; margin:0; padding:0; }
      .container { max-width:520px; margin:40px auto; background:#fff; border-radius:12px; overflow:hidden; box-shadow:0 2px 12px rgba(0,0,0,0.08); }
      .header { background:#080b12; padding:28px 32px; text-align:center; }
      .logo { font-size:22px; font-weight:900; color:#e6edf3; }
      .logo span { color:#00C853; }
      .body { padding:32px; color:#1e293b; }
      .title { font-size:20px; font-weight:800; margin-bottom:12px; }
      .text { font-size:14px; line-height:1.75; color:#64748b; margin-bottom:24px; }
      .btn { display:inline-block; background:#00C853; color:#000; font-weight:800; font-size:15px; padding:13px 32px; border-radius:9px; text-decoration:none; }
      .warning { background:#fff7ed; border:1px solid #fed7aa; border-radius:8px; padding:12px 16px; font-size:12px; color:#92400e; margin-top:24px; }
      .footer { padding:20px 32px; background:#f8fafc; font-size:12px; color:#94a3b8; text-align:center; line-height:1.75; }
      .footer a { color:#94a3b8; }
    </style></head><body>
    <div class="container">
      <div class="header"><div class="logo">True<span>Odds</span></div></div>
      <div class="body">
        <div class="title">Reset your password</div>
        <p class="text">Hi ${name},<br><br>
          We received a request to reset the password for your TrueOdds account.
          Click the button below to set a new password. This link expires in <strong>10 minutes</strong>.
        </p>
        <a href="${resetUrl}" class="btn">Reset Password →</a>
        <div class="warning">
          ⚠ If you didn't request a password reset, you can safely ignore this email.
        </div>
      </div>
      <div class="footer">
        TrueOdds, Inc. · Real-time sports betting analytics<br>
        <a href="${frontendUrl}">trueodds.ca</a> ·
        <a href="mailto:support@trueodds.ca">support@trueodds.ca</a><br><br>
        This email was sent to ${email} because a password reset was requested.
      </div>
    </div>
    </body></html>
  `

  const text = `TrueOdds — Password Reset\n\nHi ${name},\n\nReset your password (expires in 10 minutes):\n${resetUrl}\n\nIf you didn't request this, ignore this email.\n\n— TrueOdds Team`

  return sendEmail({ to: email, subject: 'Reset your TrueOdds password', html, text })
}

async function sendWelcomeEmail(email, name, plan) {
  const frontendUrl = process.env.FRONTEND_URL || 'https://trueodds.ca'
  const planLabel   = plan.charAt(0).toUpperCase() + plan.slice(1)

  const html = `
    <!DOCTYPE html><html><head><meta charset="utf-8">
    <style>
      body { font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif; background:#f8fafc; margin:0; padding:0; }
      .container { max-width:520px; margin:40px auto; background:#fff; border-radius:12px; overflow:hidden; box-shadow:0 2px 12px rgba(0,0,0,0.08); }
      .header { background:#080b12; padding:28px 32px; text-align:center; }
      .logo { font-size:22px; font-weight:900; color:#e6edf3; }
      .logo span { color:#00C853; }
      .body { padding:32px; color:#1e293b; }
      .title { font-size:20px; font-weight:800; margin-bottom:12px; }
      .text { font-size:14px; line-height:1.75; color:#64748b; margin-bottom:20px; }
      .features { background:#f8fafc; border-radius:8px; padding:16px 20px; margin-bottom:24px; }
      .feature { font-size:13px; color:#475569; margin-bottom:10px; }
      .btn { display:inline-block; background:#00C853; color:#000; font-weight:800; font-size:15px; padding:13px 32px; border-radius:9px; text-decoration:none; }
      .footer { padding:20px 32px; background:#f8fafc; font-size:12px; color:#94a3b8; text-align:center; line-height:1.75; }
      .footer a { color:#94a3b8; }
    </style></head><body>
    <div class="container">
      <div class="header"><div class="logo">True<span>Odds</span></div></div>
      <div class="body">
        <div class="title">Welcome to TrueOdds, ${name}! 🎉</div>
        <p class="text">Your <strong>${planLabel} plan</strong> 7-day free trial is now active.</p>
        <div class="features">
          <div class="feature">⚡ <strong>Arbitrage Finder</strong> — guaranteed profit regardless of outcome</div>
          <div class="feature">📈 <strong>+EV Bets</strong> — mathematically profitable long-term plays</div>
          <div class="feature">📊 <strong>Live Odds</strong> — compare 100+ sportsbooks in real time</div>
          <div class="feature">🧠 <strong>Sharp Edge</strong> — AI-powered sharp money detection</div>
          <div class="feature">🔔 <strong>Alerts</strong> — get notified when opportunities appear</div>
        </div>
        <a href="${frontendUrl}/dashboard" class="btn">Open Dashboard →</a>
      </div>
      <div class="footer">
        TrueOdds, Inc. · <a href="${frontendUrl}">trueodds.ca</a> ·
        <a href="mailto:support@trueodds.ca">support@trueodds.ca</a><br>
        Must be 19+ in Ontario. Please bet responsibly.
      </div>
    </div>
    </body></html>
  `

  return sendEmail({
    to:      email,
    subject: `Welcome to TrueOdds — your ${planLabel} trial is active 🎉`,
    html,
    text: `Welcome to TrueOdds, ${name}! Your ${planLabel} trial is active. Visit ${frontendUrl}/dashboard`,
  })
}

module.exports = { sendEmail, sendPasswordResetEmail, sendWelcomeEmail }
