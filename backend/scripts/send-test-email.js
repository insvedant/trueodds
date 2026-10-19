/**
 * Sends ONE real code email through Brevo, to check your configuration before you rely on it.
 *
 *     cd backend && node scripts/send-test-email.js you@yourdomain.com
 *
 * Uses the same settings as the app (backend/.env): BREVO_API_KEY, EMAIL_FROM_ADDRESS, ...
 * The code in the email is a dummy (123456); nothing is stored.
 */
require('dotenv').config();
const { sendOtpEmail } = require('../src/services/emailService');

const to = process.argv[2];
if (!to || !to.includes('@')) { console.error('Usage: node scripts/send-test-email.js you@example.com'); process.exit(2); }

const hints = {
    unauthorized: 'The API key was not accepted. Create a v3 API key in Brevo (SMTP & API > API keys) and check BREVO_API_KEY has no spaces or quotes.',
    invalid_parameter: 'Brevo rejected the request. Most often the sender is not verified: EMAIL_FROM_ADDRESS must be a verified sender/domain in Brevo.',
    permission_denied: 'Your Brevo account may be restricted or not yet activated for sending. Check the Brevo dashboard for a notice.',
    not_configured: 'BREVO_API_KEY is not set in backend/.env.',
    network: 'Could not reach api.brevo.com from this machine. Check the server\'s outbound HTTPS.',
    timeout: 'Brevo did not answer in time. Try again; if it repeats, check the server\'s network.',
};

(async () => {
    console.log(`Sending a test code email to ${to} from ${process.env.EMAIL_FROM_ADDRESS || 'no-reply@trueodds.ca (default)'} ...`);
    try {
        const r = await sendOtpEmail({ email: to, name: 'Test', code: '123456', purpose: 'register' });
        console.log(r.devMode ? 'DEV MODE: nothing was sent (no BREVO_API_KEY and EMAIL_DEV_MODE/NODE_ENV allows dev mode).' : `Sent. Brevo message id: ${r.messageId}`);
        if (!r.devMode) console.log('Check the inbox AND the spam folder, and look at the headers: SPF and DKIM should say "pass".');
    } catch (e) {
        console.error(`FAILED: ${e.message}`);
        if (hints[e.code]) console.error(`Hint: ${hints[e.code]}`);
        if (e.status === 401 && /ip/i.test(e.message)) console.error('Hint: Brevo blocks unknown IP addresses. Add this server\'s IP under Brevo > Security > Authorised IPs.');
        process.exit(1);
    }
})();
