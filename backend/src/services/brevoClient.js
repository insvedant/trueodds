/**
 * Minimal client for Brevo's transactional email API (POST /v3/smtp/email).
 *
 * Why the HTTPS API instead of Brevo's SMTP relay: it is one HTTPS request on port 443, so it is not
 * affected by hosts that restrict outbound SMTP ports, it returns a message id and clear JSON errors,
 * and it needs no extra dependency (Node's built-in fetch).
 *
 * Never logs or includes the API key, and never logs message bodies: OTP emails contain the code.
 */
const BREVO_URL = 'https://api.brevo.com/v3/smtp/email';

class EmailSendError extends Error {
    constructor(message, { status = null, code = 'send_failed', retryable = false } = {}) {
        super(message);
        this.name = 'EmailSendError';
        this.status = status;
        this.code = code;
        this.retryable = retryable;
    }
}

const defaultSleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

function normaliseRecipients(to) {
    const list = Array.isArray(to) ? to : [to];
    return list
        .filter(Boolean)
        .map((r) => (typeof r === 'string' ? { email: r.trim() } : { email: String(r.email).trim(), ...(r.name ? { name: r.name } : {}) }));
}

function buildPayload({ sender, to, replyTo, subject, html, text, tags }) {
    const recipients = normaliseRecipients(to);
    if (!recipients.length || !recipients.every((r) => r.email)) {
        throw new EmailSendError('No recipient email address.', { code: 'invalid_recipient' });
    }
    if (!sender?.email) throw new EmailSendError('No sender address configured.', { code: 'not_configured' });
    if (!html && !text) throw new EmailSendError('Email has no content.', { code: 'invalid_content' });
    const payload = { sender, to: recipients, subject };
    if (html) payload.htmlContent = html;
    if (text) payload.textContent = text;
    if (replyTo?.email) payload.replyTo = replyTo;
    if (tags?.length) payload.tags = tags;
    return payload;
}

function retryDelayMs(attempt, response) {
    const retryAfter = response?.headers?.get?.('retry-after');
    const seconds = retryAfter ? Number(retryAfter) : NaN;
    if (Number.isFinite(seconds) && seconds >= 0) return Math.min(seconds, 5) * 1000;    // honour Brevo's hint, but never stall a request for long
    return 400 * attempt * attempt;                                                      // 400 ms, 1.6 s
}

/**
 * Send one email. Retries network errors, timeouts, 429 and 5xx (up to `retries` times); never retries other
 * 4xx responses because repeating a rejected request cannot help (bad key, unverified sender, bad address).
 * Resolves to { messageId }. Rejects with EmailSendError.
 */
async function sendViaBrevo({
    apiKey, sender, to, replyTo, subject, html, text, tags,
    fetchImpl = globalThis.fetch, timeoutMs = 10000, retries = 2, sleep = defaultSleep,
}) {
    if (!apiKey) throw new EmailSendError('BREVO_API_KEY is not set.', { code: 'not_configured' });
    if (typeof fetchImpl !== 'function') throw new EmailSendError('fetch is not available in this Node version.', { code: 'not_configured' });
    const body = JSON.stringify(buildPayload({ sender, to, replyTo, subject, html, text, tags }));

    let lastError;
    for (let attempt = 1; attempt <= retries + 1; attempt++) {
        const controller = new AbortController();
        const timer = setTimeout(() => controller.abort(), timeoutMs);
        let response;
        try {
            response = await fetchImpl(BREVO_URL, {
                method: 'POST',
                headers: { 'api-key': apiKey, 'content-type': 'application/json', accept: 'application/json' },
                body,
                signal: controller.signal,
            });
        } catch (err) {
            lastError = new EmailSendError(
                err?.name === 'AbortError' ? `Brevo did not respond within ${timeoutMs} ms.` : `Could not reach Brevo: ${err?.message || err}`,
                { code: err?.name === 'AbortError' ? 'timeout' : 'network', retryable: true },
            );
        } finally {
            clearTimeout(timer);
        }

        if (response) {
            if (response.ok) {
                const json = await response.json().catch(() => ({}));
                return { messageId: json.messageId || (Array.isArray(json.messageIds) ? json.messageIds[0] : null) };
            }
            const details = await response.json().catch(() => ({}));
            const retryable = response.status === 429 || response.status >= 500;
            lastError = new EmailSendError(
                `Brevo rejected the email (${response.status}${details.code ? ` ${details.code}` : ''}): ${details.message || response.statusText || 'no details'}`,
                { status: response.status, code: details.code || 'rejected', retryable },
            );
            if (!retryable) throw lastError;
        }

        if (attempt <= retries) await sleep(retryDelayMs(attempt, response));
    }
    throw lastError;
}

module.exports = { sendViaBrevo, EmailSendError, BREVO_URL, buildPayload };
