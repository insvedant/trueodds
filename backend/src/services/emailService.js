/**
 * Outgoing email, via Brevo's transactional API (see brevoClient.js).
 *
 * Every email is either
 *   'transactional'  a code, a welcome, a receipt: always sent
 *   'bulk'           newsletter / blog notices / alerts: capped per day (BULK_EMAIL_DAILY_CAP) so a big send can
 *                    never use up the plan's daily allowance and stop signup or password-reset codes arriving.
 *
 * Environment:
 *   BREVO_API_KEY         required in production
 *   EMAIL_FROM_ADDRESS    must be a verified sender/domain in Brevo (default no-reply@trueodds.ca)
 *   EMAIL_FROM_NAME       default TrueOdds
 *   EMAIL_REPLY_TO        default support@trueodds.ca
 *   BULK_EMAIL_DAILY_CAP  default 150
 *   EMAIL_DEV_MODE=true   with no key, print emails to the console instead of failing (local development only)
 */
const { sendViaBrevo, EmailSendError } = require('./brevoClient');

const settings = () => ({
    apiKey: process.env.BREVO_API_KEY,
    fromName: process.env.EMAIL_FROM_NAME || 'TrueOdds',
    fromAddress: process.env.EMAIL_FROM_ADDRESS || 'no-reply@trueodds.ca',
    replyTo: process.env.EMAIL_REPLY_TO || 'support@trueodds.ca',
});

const devModeAllowed = () => process.env.EMAIL_DEV_MODE === 'true' || ['development', 'test'].includes(process.env.NODE_ENV);

/** HTML-escape text that came from a user (names, emails) before it goes into an HTML template. */
const esc = (value) => String(value ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

const bulkBudget = { day: null, count: 0 };
function takeBulkSlot(now = new Date()) {
    const day = now.toISOString().slice(0, 10);
    if (bulkBudget.day !== day) { bulkBudget.day = day; bulkBudget.count = 0; }
    const cap = Number(process.env.BULK_EMAIL_DAILY_CAP ?? 150);
    if (bulkBudget.count >= cap) return false;
    bulkBudget.count += 1;
    return true;
}
const resetBulkBudget = () => { bulkBudget.day = null; bulkBudget.count = 0; };

async function sendEmail({ to, subject, html, text, category = 'transactional', tags }) {
    const cfg = settings();
    if (!cfg.apiKey) {
        if (!devModeAllowed()) {
            throw new EmailSendError('Email is not configured: BREVO_API_KEY is missing.', { code: 'not_configured' });
        }
        console.log('\n────────────────────────────────────');
        console.log('[Email DEV MODE — not sent]');
        console.log(`TO:      ${typeof to === 'string' ? to : JSON.stringify(to)}`);
        console.log(`SUBJECT: ${subject}`);
        console.log(`BODY:    ${text || html?.slice(0, 200)}`);
        console.log('────────────────────────────────────\n');
        return { success: true, devMode: true };
    }
    if (category === 'bulk' && !takeBulkSlot()) {
        throw new EmailSendError(`Daily bulk email cap (${process.env.BULK_EMAIL_DAILY_CAP ?? 150}) reached; this email was not sent.`, { code: 'bulk_cap' });
    }
    const { messageId } = await sendViaBrevo({
        apiKey: cfg.apiKey,
        sender: { name: cfg.fromName, email: cfg.fromAddress },
        replyTo: { email: cfg.replyTo, name: `${cfg.fromName} Support` },
        to, subject, html, text,
        tags: tags || [category],
    });
    console.log(`[Email] Sent (${category}) to ${typeof to === 'string' ? to : JSON.stringify(to)} — id ${messageId}`);
    return { success: true, messageId };
}

/**
 * The one-time-code email used for signup verification and password reset.
 * Deliberately contains no clickable link: people should type the code into the page they are on.
 */
async function sendOtpEmail({ email, name, code, purpose, minutes = 10 }) {
    const frontendUrl = process.env.FRONTEND_URL || 'https://trueodds.ca';
    const isReset = purpose === 'reset';
    const title = isReset ? 'Reset your password' : 'Verify your email';
    const intro = isReset
        ? 'We received a request to reset the password for your TrueOdds account. Enter this code on the reset page:'
        : 'Welcome to TrueOdds! Enter this code on the signup page to verify your email address:';
    const ignore = isReset
        ? "If you didn't ask to reset your password, you can ignore this email. Your password will not change."
        : "If you didn't try to create a TrueOdds account, you can ignore this email.";
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
        .text       { font-size:14px; line-height:1.75; color:#64748b; margin-bottom:20px; }
        .code       { font-family:'SF Mono',Menlo,Consolas,monospace; font-size:34px; font-weight:800; letter-spacing:10px; text-align:center; background:#f1f5f9; border:1px dashed #cbd5e1; border-radius:10px; padding:16px 12px; margin:8px 0 22px; color:#0f172a; }
        .warning    { background:#fff7ed; border:1px solid #fed7aa; border-radius:8px; padding:12px 16px; font-size:12px; color:#92400e; margin-top:20px; line-height:1.6; }
        .footer     { padding:20px 32px; background:#f8fafc; font-size:12px; color:#94a3b8; text-align:center; line-height:1.75; }
        .footer a   { color:#94a3b8; }
      </style>
    </head>
    <body>
      <div class="container">
        <div class="header"><div class="logo">True<span>Odds</span></div></div>
        <div class="body">
          <div class="title">${title}</div>
          <p class="text">Hi ${esc(name || 'there')},<br><br>${intro}</p>
          <div class="code">${esc(code)}</div>
          <p class="text">This code expires in <strong>${minutes} minutes</strong> and can only be used once.</p>
          <div class="warning">🔒 Never share this code with anyone. TrueOdds will never ask you for it by phone, chat or email.<br>${ignore}</div>
        </div>
        <div class="footer">
          TrueOdds, Inc. · Real-time sports betting analytics<br>
          <a href="${frontendUrl}">trueodds.ca</a> · <a href="mailto:support@trueodds.ca">support@trueodds.ca</a><br><br>
          This email was sent to ${esc(email)}.
        </div>
      </div>
    </body>
    </html>
  `;
    const text = `TrueOdds — ${title}

Hi ${name || 'there'},

${intro}

    ${code}

This code expires in ${minutes} minutes and can only be used once.
Never share it with anyone. TrueOdds will never ask you for it.
${ignore}

— TrueOdds Team
support@trueodds.ca`;
    return sendEmail({
        to: email,
        subject: isReset ? 'Your TrueOdds password reset code' : 'Your TrueOdds verification code',
        html, text, category: 'transactional', tags: ['otp', isReset ? 'password-reset' : 'signup'],
    });
}
async function sendWelcomeEmail(email, name, plan) {
    const frontendUrl = process.env.FRONTEND_URL || 'https://trueodds.ca';
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
          <div class="title">Welcome to TrueOdds, ${esc(name)}! 🎉</div>
          <p class="text">
            Your account is ready and your free trial is active. You can see its exact end date any time under Settings → My Plan.<br>
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
        subject: `Welcome to TrueOdds — your free trial is active 🎉`,
        html,
        text: `Welcome to TrueOdds, ${name}! Your account is ready and your free trial is active. Visit ${frontendUrl}/dashboard to get started.`,
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
          <div class="title">You're subscribed, ${esc(name)}! 🎉</div>
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
        process.env.ZOHO_USER,          // legacy name: still honoured as one more owner address (e.g. the support mailbox)
    ]
        .filter(Boolean)
        .map((addr) => addr.trim())
        .filter((addr, index, self) => self.indexOf(addr) === index);
    if (!recipients.length) {
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
        <tr><td style="padding:6px 0;color:#64748b;">Name</td><td style="padding:6px 0;font-weight:700;">${esc(name)}</td></tr>
        <tr><td style="padding:6px 0;color:#64748b;">Email</td><td style="padding:6px 0;font-weight:700;">${esc(email)}</td></tr>
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
        process.env.ZOHO_USER,          // legacy name: still honoured as one more owner address (e.g. the support mailbox)
    ]
        .filter(Boolean)
        .map((addr) => addr.trim())
        .filter((addr, index, self) => self.indexOf(addr) === index);
    if (!recipients.length) {
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
        <tr><td style="padding:6px 0;color:#64748b;">Name</td><td style="padding:6px 0;font-weight:700;">${esc(name)}</td></tr>
        <tr><td style="padding:6px 0;color:#64748b;">Email</td><td style="padding:6px 0;font-weight:700;">${esc(email)}</td></tr>
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

module.exports = { sendEmail, sendOtpEmail, sendWelcomeEmail, sendSubscriptionConfirmationEmail, sendOwnerNewSubscriberAlert, sendSubscriptionLifecycleEmail, EmailSendError, esc, resetBulkBudget };
