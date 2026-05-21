/**
 * emailService.js
 * ─────────────────────────────────────────────────────────────────────────
 * Sends transactional emails via Gmail SMTP using nodemailer.
 *
 * Setup (one-time):
 *  1. Enable 2FA on your Gmail account
 *  2. Go to Google Account → Security → App Passwords
 *  3. Create an App Password for "Mail"
 *  4. Add to backend/.env:
 *       GMAIL_USER=youraddress@gmail.com
 *       GMAIL_APP_PASSWORD=xxxx xxxx xxxx xxxx   (16-char app password, no spaces)
 *
 * Gmail free tier: 500 emails/day — more than enough for password resets
 */

const nodemailer = require('nodemailer')

// ── Create transporter ────────────────────────────────────────────────────
function createTransporter() {
  const user = process.env.GMAIL_USER
  const pass = process.env.GMAIL_APP_PASSWORD

  if (!user || !pass || user.includes('REPLACE') || pass.includes('REPLACE')) {
    console.warn('[Email] Gmail not configured — password reset emails will be logged to console only')
    return null
  }

  return nodemailer.createTransport({
    service: 'gmail',
    auth: { user, pass },
  })
}

// ── Send email ────────────────────────────────────────────────────────────
async function sendEmail({ to, subject, html, text }) {
  const transporter = createTransporter()

  if (!transporter) {
    // Dev mode — log to console so you can still test the flow
    console.log('\n────────────────────────────────────')
    console.log('[Email DEV MODE — not sent to inbox]')
    console.log(`TO:      ${to}`)
    console.log(`SUBJECT: ${subject}`)
    console.log(`BODY:    ${text || html}`)
    console.log('────────────────────────────────────\n')
    return { success: true, devMode: true }
  }

  const info = await transporter.sendMail({
    from:    `"TrueOdds" <${process.env.GMAIL_USER}>`,
    to,
    subject,
    html,
    text,
  })

  console.log(`[Email] Sent to ${to} — MessageId: ${info.messageId}`)
  return { success: true, messageId: info.messageId }
}

// ── Password reset email ──────────────────────────────────────────────────
async function sendPasswordResetEmail(email, name, resetToken) {
  const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:3000'
  const resetUrl    = `${frontendUrl}/reset-password?token=${resetToken}`

  const html = `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <style>
        body        { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; background:#f8fafc; margin:0; padding:0; }
        .container  { max-width:520px; margin:40px auto; background:#ffffff; border-radius:12px; overflow:hidden; box-shadow:0 2px 12px rgba(0,0,0,0.08); }
        .header     { background:#080b12; padding:28px 32px; text-align:center; }
        .logo       { font-size:22px; font-weight:900; color:#e6edf3; letter-spacing:-0.5px; }
        .logo span  { color:#00C853; }
        .body       { padding:32px; color:#1e293b; }
        .title      { font-size:20px; font-weight:800; margin-bottom:12px; }
        .text       { font-size:14px; line-height:1.75; color:#64748b; margin-bottom:20px; }
        .btn        { display:inline-block; background:#00C853; color:#000000; font-weight:800; font-size:15px; padding:13px 32px; border-radius:9px; text-decoration:none; }
        .footer     { padding:20px 32px; background:#f8fafc; font-size:12px; color:#94a3b8; text-align:center; line-height:1.75; }
        .warning    { background:#fff7ed; border:1px solid #fed7aa; border-radius:8px; padding:12px 16px; font-size:12px; color:#92400e; margin-top:20px; }
      </style>
    </head>
    <body>
      <div class="container">
        <div class="header">
          <div class="logo">True<span>Odds</span></div>
        </div>
        <div class="body">
          <div class="title">Reset your password</div>
          <p class="text">Hi ${name},<br><br>
            We received a request to reset the password for your TrueOdds account.<br>
            Click the button below to set a new password.
          </p>
          <a href="${resetUrl}" class="btn">Reset Password →</a>
          <div class="warning">
            ⚠ This link expires in <strong>10 minutes</strong>.<br>
            If you didn't request a password reset, you can safely ignore this email.
          </div>
        </div>
        <div class="footer">
          TrueOdds · Real-time sports betting tools<br>
          <a href="${frontendUrl}" style="color:#94a3b8">trueodds.com</a> · 
          <a href="${frontendUrl}/responsible-gaming" style="color:#94a3b8">Responsible Gaming</a><br><br>
          This email was sent to ${email}. If you didn't request this, no action needed.
        </div>
      </div>
    </body>
    </html>
  `

  const text = `
TrueOdds — Password Reset

Hi ${name},

Click the link below to reset your password (expires in 10 minutes):
${resetUrl}

If you didn't request a password reset, ignore this email.

— TrueOdds Team
  `.trim()

  return sendEmail({ to: email, subject: 'Reset your TrueOdds password', html, text })
}

// ── Welcome email ─────────────────────────────────────────────────────────
async function sendWelcomeEmail(email, name, plan) {
  const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:3000'

  const html = `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <style>
        body { font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif; background:#f8fafc; margin:0; padding:0; }
        .container { max-width:520px; margin:40px auto; background:#ffffff; border-radius:12px; overflow:hidden; box-shadow:0 2px 12px rgba(0,0,0,0.08); }
        .header { background:#080b12; padding:28px 32px; text-align:center; }
        .logo { font-size:22px; font-weight:900; color:#e6edf3; }
        .logo span { color:#00C853; }
        .body { padding:32px; color:#1e293b; }
        .title { font-size:20px; font-weight:800; margin-bottom:12px; }
        .text { font-size:14px; line-height:1.75; color:#64748b; margin-bottom:20px; }
        .btn { display:inline-block; background:#00C853; color:#000; font-weight:800; font-size:15px; padding:13px 32px; border-radius:9px; text-decoration:none; }
        .features { background:#f8fafc; border-radius:8px; padding:16px 20px; margin-bottom:20px; }
        .feature { font-size:13px; color:#475569; margin-bottom:8px; }
        .footer { padding:20px 32px; background:#f8fafc; font-size:12px; color:#94a3b8; text-align:center; }
      </style>
    </head>
    <body>
      <div class="container">
        <div class="header"><div class="logo">True<span>Odds</span></div></div>
        <div class="body">
          <div class="title">Welcome to TrueOdds, ${name}! 🎉</div>
          <p class="text">Your <strong>${plan.charAt(0).toUpperCase()+plan.slice(1)} plan</strong> 7-day free trial is now active. Here's what you can do:</p>
          <div class="features">
            <div class="feature">⚡ <strong>Arbitrage Finder</strong> — guaranteed profit on every bet</div>
            <div class="feature">📈 <strong>+EV Betting</strong> — mathematically profitable plays</div>
            <div class="feature">📊 <strong>Live Odds</strong> — compare 100+ sportsbooks instantly</div>
            <div class="feature">🧠 <strong>ML Insights</strong> — sharp money and CLV predictions</div>
          </div>
          <a href="${frontendUrl}/dashboard" class="btn">Open Dashboard →</a>
        </div>
        <div class="footer">
          TrueOdds · <a href="${frontendUrl}" style="color:#94a3b8">trueodds.com</a><br>
          Must be 21+ to use sportsbooks. Bet responsibly.
        </div>
      </div>
    </body>
    </html>
  `

  return sendEmail({
    to:      email,
    subject: `Welcome to TrueOdds — your trial is active`,
    html,
    text:    `Welcome to TrueOdds, ${name}! Your ${plan} trial is active. Visit ${frontendUrl}/dashboard to get started.`,
  })
}

module.exports = { sendEmail, sendPasswordResetEmail, sendWelcomeEmail }
