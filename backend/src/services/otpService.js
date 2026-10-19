/**
 * One-time email codes for signup verification and password reset.
 *
 * Rules (each one is covered by tests/otp.test.js):
 *   - 6 digits from a cryptographic random source; valid for 10 minutes; usable once
 *   - only an HMAC of the code is stored (keyed with a server secret and bound to email + purpose), so a
 *     database leak does not reveal live codes and a code for one purpose/email cannot be used for another
 *   - at most 5 wrong guesses per code, counted atomically BEFORE the comparison
 *   - a new code can be requested after 60 seconds, and at most 5 times an hour per email and purpose
 *   - signup verification ends in a signed token (30 minutes) that is bound to the verified email address
 */
const crypto = require('crypto');
const jwt = require('jsonwebtoken');
const { mongoStore } = require('./otpStore');

const OTP_TTL_MS = 10 * 60 * 1000;
const MAX_ATTEMPTS = 5;
const RESEND_COOLDOWN_MS = 60 * 1000;
const HOUR_MS = 60 * 60 * 1000;
const MAX_SENDS_PER_HOUR = 5;
const VERIFICATION_TOKEN_TTL = '30m';
const RECORD_KEEP_MS = 2 * HOUR_MS;                      // how long a row lingers (the rate-limit window) before it deletes itself

class OtpError extends Error {
    constructor(code, extra = {}) {
        super(code);
        this.name = 'OtpError';
        this.code = code;
        Object.assign(this, extra);
    }
}

function createOtpService({ store = mongoStore, now = Date.now, random = (max) => crypto.randomInt(0, max), secret = () => process.env.OTP_SECRET || process.env.JWT_SECRET } = {}) {
    const key = () => {
        const s = secret();
        if (!s) throw new Error('OTP_SECRET or JWT_SECRET must be set.');
        return s;
    };
    const norm = (email) => String(email || '').trim().toLowerCase();
    const hash = (email, purpose, code) => crypto.createHmac('sha256', key()).update(`${purpose}:${email}:${code}`).digest('hex');

    return {
        constants: { OTP_TTL_MS, MAX_ATTEMPTS, RESEND_COOLDOWN_MS, MAX_SENDS_PER_HOUR },

        /** Create a fresh code. Returns { code, expiresInSeconds } or throws OtpError('cooldown' | 'rate_limited'). */
        async issue({ email, purpose }) {
            email = norm(email);
            const t = now();
            const existing = await store.get(email, purpose);
            let windowStart = t;
            let sendCount = 0;
            if (existing) {
                const sinceLast = t - new Date(existing.lastSentAt).getTime();
                if (sinceLast < RESEND_COOLDOWN_MS) {
                    throw new OtpError('cooldown', { retryAfterSeconds: Math.ceil((RESEND_COOLDOWN_MS - sinceLast) / 1000) });
                }
                const windowAge = t - new Date(existing.windowStart).getTime();
                if (windowAge < HOUR_MS) {
                    windowStart = new Date(existing.windowStart).getTime();
                    sendCount = existing.sendCount;
                    if (sendCount >= MAX_SENDS_PER_HOUR) {
                        throw new OtpError('rate_limited', { retryAfterSeconds: Math.ceil((HOUR_MS - windowAge) / 1000) });
                    }
                }
            }
            const code = String(random(1_000_000)).padStart(6, '0');
            await store.save({
                email, purpose,
                codeHash: hash(email, purpose, code),
                expiresAt: new Date(t + OTP_TTL_MS),
                attempts: 0,
                lastSentAt: new Date(t),
                windowStart: new Date(windowStart),
                sendCount: sendCount + 1,
                purgeAt: new Date(t + RECORD_KEEP_MS),
            });
            return { code, expiresInSeconds: OTP_TTL_MS / 1000 };
        },

        /** The email could not be sent: forget the code (and the cooldown) so the person can simply try again. */
        async discard({ email, purpose }) {
            await store.remove(norm(email), purpose);
        },

        /**
         * Check a code. Resolves true, or throws OtpError:
         *   'invalid' (with attemptsLeft) | 'locked' | 'expired' | 'not_found'
         * A correct code is deleted, so it cannot be used twice.
         */
        async verify({ email, purpose, code }) {
            email = norm(email);
            const t = now();
            const claim = await store.claimAttempt(email, purpose, MAX_ATTEMPTS, t);
            if (!claim.record) throw new OtpError(claim.reason);
            const expected = Buffer.from(claim.record.codeHash, 'hex');
            const given = Buffer.from(hash(email, purpose, String(code || '').trim()), 'hex');
            const ok = expected.length === given.length && crypto.timingSafeEqual(expected, given);
            if (!ok) {
                const attemptsLeft = Math.max(0, MAX_ATTEMPTS - claim.record.attempts);
                throw new OtpError(attemptsLeft === 0 ? 'locked' : 'invalid', { attemptsLeft });
            }
            // Several correct submissions can arrive at the same instant. Only the one that actually deletes the
            // code gets to use it, so a code really is single-use.
            if (!(await store.consume(email, purpose, claim.record.codeHash))) throw new OtpError('not_found');
            return true;
        },

        /** Proof, for the signup form, that this email address was verified. Bound to the address. */
        issueVerificationToken({ email }) {
            return jwt.sign({ email: norm(email), purpose: 'signup-email-verified' }, key(), { expiresIn: VERIFICATION_TOKEN_TTL });
        },

        /** { ok: true } only for a genuine, unexpired token issued for exactly this email address. */
        checkVerificationToken({ email, token }) {
            if (!token || typeof token !== 'string') return { ok: false, reason: 'missing' };
            try {
                const payload = jwt.verify(token, key(), { algorithms: ['HS256'] });
                if (payload.purpose !== 'signup-email-verified') return { ok: false, reason: 'wrong_purpose' };
                if (payload.email !== norm(email)) return { ok: false, reason: 'wrong_email' };
                return { ok: true };
            } catch (e) {
                return { ok: false, reason: e.name === 'TokenExpiredError' ? 'expired' : 'invalid' };
            }
        },
    };
}

module.exports = { createOtpService, OtpError, otp: createOtpService(), OTP_TTL_MS, MAX_ATTEMPTS };
