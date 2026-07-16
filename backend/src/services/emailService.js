const nodemailer = require('nodemailer');
const FROM_NAME = 'TrueOdds';
const FROM_ADDRESS = process.env.ZOHO_USER || 'support@trueodds.ca';
function createTransporter() {
    const user = process.env.ZOHO_USER;
    const pass = process.env.ZOHO_PASSWORD;
    if (!user || !pass) {
        console.warn('[Email] Zoho not configured — emails will be logged to console only');
        return null;
    }
    return nodemailer.createTransport({
        host: 'smtp.zoho.com',
        port: 465,
        secure: true,
        auth: { user, pass },
    });
}
async function sendEmail({ to, subject, html, text }) {
    const transporter = createTransporter();
    if (!transporter) {
        console.log('\n────────────────────────────────────');
        console.log('[Email DEV MODE — not sent]');
        console.log(`TO:      ${to}`);
        console.log(`SUBJECT: ${subject}`);
        console.log(`BODY:    ${text || html?.slice(0, 200)}`);
        console.log('────────────────────────────────────\n');
        return { success: true, devMode: true };
    }
    const info = await transporter.sendMail({
        from: `"${FROM_NAME}" <${FROM_ADDRESS}>`,
        to,
        subject,
        html,
        text,
    });
    console.log(`[Email] Sent to ${to} — MessageId: ${info.messageId}`);
    return { success: true, messageId: info.messageId };
}
async function sendPasswordResetEmail(email, name, resetToken) {
    const frontendUrl = process.env.FRONTEND_URL || 'https://trueodds.ca';
    const resetUrl = `${frontendUrl}/reset-password?token=${resetToken}`;
    const html = `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <style>
        body        { font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif; background:#f8fafc; margin:0; padding:0; }
        .container  { max-width:520px; margin:40px auto; background:#ffffff; border-radius:12px; overflow:hidden; box-shadow:0 2px 12px rgba(0,0,0,0.08); }
        .header     { background:#080b12; padding:28px 32px; text-align:center; }
        .logo       { font-size:22px; font-weight:900; color:#e6edf3; letter-spacing:-0.5px; }
        .logo span  { color:#00C853; }
        .body       { padding:32px; color:#1e293b; }
        .title      { font-size:20px; font-weight:800; margin-bottom:12px; }
        .text       { font-size:14px; line-height:1.75; color:#64748b; margin-bottom:24px; }
        .btn        { display:inline-block; background:#00C853; color:#000000; font-weight:800; font-size:15px; padding:13px 32px; border-radius:9px; text-decoration:none; }
        .warning    { background:#fff7ed; border:1px solid #fed7aa; border-radius:8px; padding:12px 16px; font-size:12px; color:#92400e; margin-top:24px; }
        .footer     { padding:20px 32px; background:#f8fafc; font-size:12px; color:#94a3b8; text-align:center; line-height:1.75; }
        .footer a   { color:#94a3b8; }
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
            Click the button below to set a new password. This link expires in <strong>10 minutes</strong>.
          </p>
          <a href="${resetUrl}" class="btn">Reset Password →</a>
          <div class="warning">
            ⚠ If you didn't request a password reset, you can safely ignore this email.
            Your password will not change.
          </div>
        </div>
        <div class="footer">
          TrueOdds, Inc. · Real-time sports betting analytics<br>
          <a href="${frontendUrl}">trueodds.ca</a> ·
          <a href="mailto:support@trueodds.ca">support@trueodds.ca</a><br><br>
          This email was sent to ${email} because a password reset was requested.
        </div>
      </div>
    </body>
    </html>
  `;
    const text = `
TrueOdds — Password Reset

Hi ${name},

Click the link below to reset your password (expires in 10 minutes):
${resetUrl}

If you didn't request a password reset, ignore this email.

— TrueOdds Team
support@trueodds.ca
  `.trim();
    return sendEmail({ to: email, subject: 'Reset your TrueOdds password', html, text });
}
async function sendWelcomeEmail(email, name, plan) {
    const frontendUrl = process.env.FRONTEND_URL || 'https://trueodds.ca';
    const planLabel = plan.charAt(0).toUpperCase() + plan.slice(1);
    const html = `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <style>
        body        { font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif; background:#f8fafc; margin:0; padding:0; }
        .container  { max-width:520px; margin:40px auto; background:#ffffff; border-radius:12px; overflow:hidden; box-shadow:0 2px 12px rgba(0,0,0,0.08); }
        .header     { background:#080b12; padding:28px 32px; text-align:center; }
        .logo       { font-size:22px; font-weight:900; color:#e6edf3; }
        .logo span  { color:#00C853; }
        .body       { padding:32px; color:#1e293b; }
        .title      { font-size:20px; font-weight:800; margin-bottom:12px; }
        .text       { font-size:14px; line-height:1.75; color:#64748b; margin-bottom:20px; }
        .features   { background:#f8fafc; border-radius:8px; padding:16px 20px; margin-bottom:24px; }
        .feature    { font-size:13px; color:#475569; margin-bottom:10px; }
        .btn        { display:inline-block; background:#00C853; color:#000; font-weight:800; font-size:15px; padding:13px 32px; border-radius:9px; text-decoration:none; }
        .footer     { padding:20px 32px; background:#f8fafc; font-size:12px; color:#94a3b8; text-align:center; line-height:1.75; }
        .footer a   { color:#94a3b8; }
      </style>
    </head>
    <body>
      <div class="container">
        <div class="header"><div class="logo">True<span>Odds</span></div></div>
        <div class="body">
          <div class="title">Welcome to TrueOdds, ${name}! 🎉</div>
          <p class="text">
            Your <strong>${planLabel} plan</strong> 7-day free trial is now active.<br>
            Here's what's waiting for you in your dashboard:
          </p>
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
    </body>
    </html>
  `;
    return sendEmail({
        to: email,
        subject: `Welcome to TrueOdds — your ${planLabel} trial is active 🎉`,
        html,
        text: `Welcome to TrueOdds, ${name}! Your ${planLabel} trial is active. Visit ${frontendUrl}/dashboard to get started.`,
    });
}
async function sendSubscriptionConfirmationEmail(email, name, plan, billingPeriod, price) {
    const frontendUrl = process.env.FRONTEND_URL || 'https://trueodds.ca';
    const planLabel = plan.charAt(0).toUpperCase() + plan.slice(1);
    const periodLabel = billingPeriod === 'yearly' ? 'year' : 'month';
    const html = `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <style>
        body        { font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif; background:#f8fafc; margin:0; padding:0; }
        .container  { max-width:520px; margin:40px auto; background:#ffffff; border-radius:12px; overflow:hidden; box-shadow:0 2px 12px rgba(0,0,0,0.08); }
        .header     { background:#080b12; padding:28px 32px; text-align:center; }
        .logo       { font-size:22px; font-weight:900; color:#e6edf3; }
        .logo span  { color:#00C853; }
        .body       { padding:32px; color:#1e293b; }
        .title      { font-size:20px; font-weight:800; margin-bottom:12px; }
        .text       { font-size:14px; line-height:1.75; color:#64748b; margin-bottom:20px; }
        .receipt    { background:#f8fafc; border-radius:8px; padding:16px 20px; margin-bottom:24px; }
        .row        { display:flex; justify-content:space-between; font-size:13px; color:#475569; margin-bottom:8px; }
        .row b      { color:#1e293b; }
        .btn        { display:inline-block; background:#00C853; color:#000; font-weight:800; font-size:15px; padding:13px 32px; border-radius:9px; text-decoration:none; }
        .footer     { padding:20px 32px; background:#f8fafc; font-size:12px; color:#94a3b8; text-align:center; line-height:1.75; }
        .footer a   { color:#94a3b8; }
      </style>
    </head>
    <body>
      <div class="container">
        <div class="header"><div class="logo">True<span>Odds</span></div></div>
        <div class="body">
          <div class="title">You're subscribed, ${name}! 🎉</div>
          <p class="text">
            Your <strong>${planLabel}</strong> subscription is confirmed.
            Your 7-day free trial has started — you won't be charged until it ends.
          </p>
          <div class="receipt">
            <div class="row"><span>Plan</span><b>${planLabel}</b></div>
            <div class="row"><span>Billing</span><b>$${price} / ${periodLabel}</b></div>
            <div class="row"><span>Trial</span><b>7 days free</b></div>
          </div>
          <a href="${frontendUrl}/dashboard" class="btn">Open Dashboard →</a>
        </div>
        <div class="footer">
          TrueOdds, Inc. · <a href="${frontendUrl}">trueodds.ca</a> ·
          <a href="mailto:support@trueodds.ca">support@trueodds.ca</a><br>
          You can cancel anytime from your account settings. Must be 19+ in Ontario. Please bet responsibly.
        </div>
      </div>
    </body>
    </html>
  `;
    return sendEmail({
        to: email,
        subject: `You're subscribed — ${planLabel} plan confirmed 🎉`,
        html,
        text: `You're subscribed to the ${planLabel} plan ($${price}/${periodLabel}). Your 7-day free trial has started. Visit ${frontendUrl}/dashboard.`,
    });
}
async function sendOwnerNewSubscriberAlert({ name, email, plan, billingPeriod, price }) {
    const recipients = [
        process.env.OWNER_EMAIL,
        process.env.SEC_EMAIL,
        process.env.ZOHO_USER,
    ]
        .filter(Boolean)
        .filter((addr, index, self) => self.indexOf(addr) === index)
        .join(', ');
    if (!recipients) {
        console.warn('[Email] No owner email configured — skipping new-subscriber owner alert');
        return { success: false, skipped: true };
    }
    const planLabel = plan.charAt(0).toUpperCase() + plan.slice(1);
    const periodLabel = billingPeriod === 'yearly' ? 'year' : 'month';
    const html = `
    <div style="font-family:-apple-system,sans-serif;max-width:480px;margin:0 auto;">
      <h2 style="margin-bottom:4px;">💰 New TrueOdds Subscriber</h2>
      <p style="color:#64748b;font-size:13px;margin-top:0;">
        A new paid subscription has been successfully created.
      </p>
      <table style="width:100%;font-size:14px;border-collapse:collapse;">
        <tr><td style="padding:6px 0;color:#64748b;">Name</td><td style="padding:6px 0;font-weight:700;">${name}</td></tr>
        <tr><td style="padding:6px 0;color:#64748b;">Email</td><td style="padding:6px 0;font-weight:700;">${email}</td></tr>
        <tr><td style="padding:6px 0;color:#64748b;">Plan</td><td style="padding:6px 0;font-weight:700;">${planLabel}</td></tr>
        <tr><td style="padding:6px 0;color:#64748b;">Billing</td><td style="padding:6px 0;font-weight:700;">$${price} / ${periodLabel}</td></tr>
      </table>
      <br>
      <p style="font-size:13px;color:#64748b;">
        This notification was automatically generated by the TrueOdds platform.
      </p>
    </div>
  `;
    return sendEmail({
        to: recipients,
        subject: `💰 New subscriber: ${name} — ${planLabel} (${periodLabel}ly)`,
        html,
        text: `New subscriber: ${name} (${email}) — ${planLabel} plan, $${price}/${periodLabel}.`,
    });
}

const LIFECYCLE_COPY = {
    trial_converted: { emoji: '✅', title: 'Trial converted to paid', blurb: 'A 7-day trial just successfully converted — the card was charged.' },
    payment_failed: { emoji: '⚠️', title: 'Trial payment failed', blurb: "A trial ended, but the card charge failed. This user's subscription is now past due." },
    subscription_cancelled: { emoji: '❌', title: 'Subscription cancelled', blurb: 'A subscriber has cancelled — their plan has reverted to free.' },
};

// Fires for the three subscription lifecycle moments TrueOdds admins want
// visibility on: a trial successfully converting to a paid charge, a trial's
// charge failing, and a subscriber cancelling outright. Reuses the same
// OWNER_EMAIL + SEC_EMAIL + ZOHO_USER recipient list as the new-subscriber alert.
async function sendSubscriptionLifecycleEmail(eventType, { name, email, plan, amount = null }) {
    const recipients = [
        process.env.OWNER_EMAIL,
        process.env.SEC_EMAIL,
        process.env.ZOHO_USER,
    ]
        .filter(Boolean)
        .filter((addr, index, self) => self.indexOf(addr) === index)
        .join(', ');
    if (!recipients) {
        console.warn(`[Email] No owner email configured — skipping ${eventType} alert`);
        return { success: false, skipped: true };
    }

    const copy = LIFECYCLE_COPY[eventType] || { emoji: '🔔', title: eventType, blurb: '' };
    const planLabel = plan ? plan.charAt(0).toUpperCase() + plan.slice(1) : 'Unknown';
    const dateStr = new Date().toLocaleString('en-US', { dateStyle: 'medium', timeStyle: 'short' });

    const html = `
    <div style="font-family:-apple-system,sans-serif;max-width:480px;margin:0 auto;">
      <h2 style="margin-bottom:4px;">${copy.emoji} ${copy.title}</h2>
      <p style="color:#64748b;font-size:13px;margin-top:0;">${copy.blurb}</p>
      <table style="width:100%;font-size:14px;border-collapse:collapse;">
        <tr><td style="padding:6px 0;color:#64748b;">Name</td><td style="padding:6px 0;font-weight:700;">${name}</td></tr>
        <tr><td style="padding:6px 0;color:#64748b;">Email</td><td style="padding:6px 0;font-weight:700;">${email}</td></tr>
        <tr><td style="padding:6px 0;color:#64748b;">Plan</td><td style="padding:6px 0;font-weight:700;">${planLabel}</td></tr>
        ${amount !== null ? `<tr><td style="padding:6px 0;color:#64748b;">Amount</td><td style="padding:6px 0;font-weight:700;">$${amount}</td></tr>` : ''}
        <tr><td style="padding:6px 0;color:#64748b;">Date</td><td style="padding:6px 0;font-weight:700;">${dateStr}</td></tr>
      </table>
      <br>
      <p style="font-size:13px;color:#64748b;">This notification was automatically generated by the TrueOdds platform.</p>
    </div>
  `;

    return sendEmail({
        to: recipients,
        subject: `${copy.emoji} ${copy.title}: ${name}`,
        html,
        text: `${copy.title}: ${name} (${email}) — ${planLabel} plan.${amount !== null ? ` Amount: $${amount}.` : ''}`,
    });
}

module.exports = { sendEmail, sendPasswordResetEmail, sendWelcomeEmail, sendSubscriptionConfirmationEmail, sendOwnerNewSubscriberAlert, sendSubscriptionLifecycleEmail };
