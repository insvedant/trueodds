const { test, describe, before, after, beforeEach } = require('node:test');
const assert = require('node:assert/strict');
const http = require('node:http');
const crypto = require('node:crypto');
const express = require('express');
const h = require('./helpers');

process.env.JWT_SECRET = 'route-test-jwt-secret';
const realOtp = require('../src/services/otpService');
const { memoryStore } = require('../src/services/otpStore');

function stubModule(rel, exportsObj) {
    const filename = h.abs(rel);
    require.cache[filename] = { id: filename, filename, loaded: true, exports: exportsObj, children: [], paths: [] };
}

// ---- fakes -------------------------------------------------------------------------------------------------
const clock = { t: 1_800_000_000_000 };
const store = memoryStore();
const otpInstance = realOtp.createOtpService({ store, now: () => clock.t, secret: () => 'otp-route-test-secret' });

const inbox = { codes: [], welcomes: [], failNext: false };
const emailStub = {
    sendOtpEmail: async (args) => { if (inbox.failNext) { inbox.failNext = false; throw new Error('Brevo down'); } inbox.codes.push(args); return { success: true }; },
    sendWelcomeEmail: async (...args) => { inbox.welcomes.push(args); return { success: true }; },
};

const users = [];
function makeUser(data) {
    const u = { _id: `u${users.length + 1}`, plan: 'free', role: 'user', isActive: true, ...data };
    u.toPublicJSON = () => ({ id: u._id, name: u.name, email: u.email, plan: u.plan });
    u.createPasswordResetToken = () => {
        const raw = crypto.randomBytes(32).toString('hex');
        u.passwordResetToken = crypto.createHash('sha256').update(raw).digest('hex');
        u.passwordResetExpires = new Date(Date.now() + 10 * 60 * 1000);
        return raw;
    };
    u.save = async () => u;
    return u;
}
const matches = (u, filter) => Object.entries(filter).every(([k, v]) => (v && typeof v === 'object' && '$gt' in v ? u[k] && u[k] > v.$gt : u[k] === v));
const query = (value) => { const p = Promise.resolve(value); p.select = () => p; return p; };
const UserModel = {
    findOne: (filter) => query(users.find((u) => matches(u, filter)) || null),
    create: async (data) => { const u = makeUser(data); users.push(u); return u; },
};

stubModule('models/User.js', UserModel);
stubModule('services/emailService.js', emailStub);
stubModule('services/otpService.js', { otp: otpInstance, OtpError: realOtp.OtpError });
stubModule('services/geoService.js', { getLocationFromIp: async () => null });
stubModule('services/logActivity.js', { logActivity: () => {} });
stubModule('middleware/auth.js', { protect: (req, res, next) => next() });

let server, base;
before(async () => {
    const app = express();
    app.use(express.json());
    app.use('/api/auth', require('../src/routes/auth'));
    server = http.createServer(app);
    await new Promise((r) => server.listen(0, r));
    base = `http://127.0.0.1:${server.address().port}`;
});
after(() => server.close());
beforeEach(() => {
    store.rows.clear(); users.length = 0; inbox.codes.length = 0; inbox.welcomes.length = 0; inbox.failNext = false;
    clock.t = 1_800_000_000_000;
    delete process.env.EMAIL_VERIFICATION_REQUIRED;
});

const post = async (path, body) => {
    const r = await fetch(`${base}/api/auth${path}`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) });
    return { status: r.status, json: await r.json() };
};
const advance = (seconds) => { clock.t += seconds * 1000; };
const lastCode = () => inbox.codes[inbox.codes.length - 1].code;
const addUser = (over = {}) => { const u = makeUser({ name: 'Existing Eve', email: 'eve@example.com', password: 'oldpass', ...over }); users.push(u); return u; };

async function verifiedToken(email = 'sam@example.com') {
    await post('/register/request-otp', { email, name: 'Sam' });
    const r = await post('/register/verify-otp', { email, code: lastCode() });
    return r.json.verificationToken;
}
const signupBody = (over = {}) => ({ name: 'Sam Better', email: 'sam@example.com', phone: '', password: 'secret1', ...over });

describe('signup: asking for a code', () => {
    test('rejects a missing or malformed email without sending anything', async () => {
        for (const email of ['', undefined, 'not-an-email', 'a@b', 'two words@x.com']) {
            const r = await post('/register/request-otp', { email });
            assert.equal(r.status, 400, String(email));
        }
        assert.equal(inbox.codes.length, 0);
    });
    test('refuses an email that already has an account', async () => {
        addUser();
        const r = await post('/register/request-otp', { email: 'EVE@example.com' });
        assert.equal(r.status, 400); assert.match(r.json.message, /already exists/); assert.equal(inbox.codes.length, 0);
    });
    test('emails a six-digit code to the normalised address, and tells the page how long it lives', async () => {
        const r = await post('/register/request-otp', { email: '  Sam@Example.COM ', name: ' Sam ' });
        assert.equal(r.status, 200);
        assert.deepEqual([r.json.success, r.json.resendAfterSeconds, r.json.expiresInSeconds], [true, 60, 600]);
        assert.equal(inbox.codes.length, 1);
        assert.match(inbox.codes[0].code, /^\d{6}$/);
        assert.deepEqual([inbox.codes[0].email, inbox.codes[0].name, inbox.codes[0].purpose], ['sam@example.com', 'Sam', 'register']);
    });
    test('the code never appears in the HTTP response', async () => {
        const r = await post('/register/request-otp', { email: 'sam@example.com' });
        assert.ok(!JSON.stringify(r.json).includes(lastCode()));
    });
    test('a second request within a minute is refused with the wait; after a minute it works and the old code dies', async () => {
        await post('/register/request-otp', { email: 'sam@example.com' });
        const first = lastCode();
        const tooSoon = await post('/register/request-otp', { email: 'sam@example.com' });
        assert.equal(tooSoon.status, 429); assert.equal(tooSoon.json.code, 'cooldown'); assert.ok(tooSoon.json.retryAfterSeconds > 0);
        assert.equal(inbox.codes.length, 1);
        advance(61);
        assert.equal((await post('/register/request-otp', { email: 'sam@example.com' })).status, 200);
        assert.equal(inbox.codes.length, 2);
        if (first !== lastCode()) assert.equal((await post('/register/verify-otp', { email: 'sam@example.com', code: first })).status, 400);
    });
    test('if the email cannot be sent the person gets an honest error and can retry immediately', async () => {
        inbox.failNext = true;
        const failed = await post('/register/request-otp', { email: 'sam@example.com' });
        assert.equal(failed.status, 502); assert.match(failed.json.message, /could not send/i);
        assert.equal((await post('/register/request-otp', { email: 'sam@example.com' })).status, 200);
    });
});

describe('signup: checking the code', () => {
    test('anything that is not six digits is rejected without using up a guess', async () => {
        await post('/register/request-otp', { email: 'sam@example.com' });
        for (const code of ['', '12345', '1234567', 'abcdef', '12 456', undefined]) assert.equal((await post('/register/verify-otp', { email: 'sam@example.com', code })).status, 400);
        const wrong = await post('/register/verify-otp', { email: 'sam@example.com', code: '000000' });
        if (lastCode() !== '000000') assert.equal(wrong.json.attemptsLeft, 4);
    });
    test('a wrong code says how many tries are left, and five wrong codes lock it', async () => {
        await post('/register/request-otp', { email: 'sam@example.com' });
        const real = lastCode();
        const bad = real === '000000' ? '111111' : '000000';
        const lefts = [];
        for (let i = 0; i < 4; i++) lefts.push((await post('/register/verify-otp', { email: 'sam@example.com', code: bad })).json.attemptsLeft);
        assert.deepEqual(lefts, [4, 3, 2, 1]);
        const locked = await post('/register/verify-otp', { email: 'sam@example.com', code: bad });
        assert.equal(locked.status, 429); assert.equal(locked.json.code, 'locked');
        assert.equal((await post('/register/verify-otp', { email: 'sam@example.com', code: real })).status, 429, 'locked means locked, even for the right code');
    });
    test('the right code returns a verification token, once', async () => {
        await post('/register/request-otp', { email: 'sam@example.com' });
        const code = lastCode();
        const ok = await post('/register/verify-otp', { email: 'sam@example.com', code });
        assert.equal(ok.status, 200); assert.ok(ok.json.verificationToken.split('.').length === 3);
        assert.equal((await post('/register/verify-otp', { email: 'sam@example.com', code })).status, 400);
    });
    test('an expired code is refused with a clear message', async () => {
        await post('/register/request-otp', { email: 'sam@example.com' });
        advance(11 * 60);
        const r = await post('/register/verify-otp', { email: 'sam@example.com', code: lastCode() });
        assert.equal(r.status, 400); assert.equal(r.json.code, 'expired'); assert.match(r.json.message, /expired/i);
    });
});

describe('signup: creating the account', () => {
    test('the whole journey: code, verify, register, welcome email', async () => {
        const token = await verifiedToken();
        const r = await post('/register', signupBody({ verificationToken: token }));
        assert.equal(r.status, 201); assert.ok(r.json.token); assert.equal(r.json.user.email, 'sam@example.com');
        assert.ok(users[0].emailVerifiedAt instanceof Date);
        assert.equal(inbox.welcomes.length, 1); assert.deepEqual([inbox.welcomes[0][0], inbox.welcomes[0][1]], ['sam@example.com', 'Sam Better']);
    });
    test('without proof of verification the account is not created', async () => {
        const r = await post('/register', signupBody());
        assert.equal(r.status, 400); assert.equal(r.json.code, 'email_verification_required');
        assert.equal(users.length, 0); assert.equal(inbox.welcomes.length, 0);
    });
    test('a token for someone else\'s address, or a made-up token, does not work', async () => {
        const otherToken = await verifiedToken('other@example.com');
        for (const verificationToken of [otherToken, 'garbage', '', null, 12345]) {
            const r = await post('/register', signupBody({ verificationToken }));
            assert.equal(r.status, 400, String(verificationToken)); assert.equal(r.json.code, 'email_verification_required');
        }
        assert.equal(users.length, 0);
    });
    test('the token cannot create a second account for the same address', async () => {
        const token = await verifiedToken();
        assert.equal((await post('/register', signupBody({ verificationToken: token }))).status, 201);
        assert.equal((await post('/register', signupBody({ verificationToken: token }))).status, 400);
        assert.equal(users.length, 1);
    });
    test('the other signup checks still apply', async () => {
        const token = await verifiedToken();
        assert.equal((await post('/register', signupBody({ verificationToken: token, password: '123' }))).status, 400);
        assert.equal((await post('/register', signupBody({ verificationToken: token, name: '' }))).status, 400);
        assert.equal(users.length, 0);
    });
    test('rollout switch: EMAIL_VERIFICATION_REQUIRED=false lets the old signup page keep working', async () => {
        for (const value of ['false', 'FALSE', ' false']) {
            users.length = 0;
            process.env.EMAIL_VERIFICATION_REQUIRED = value.trim();
            const r = await post('/register', signupBody());
            assert.equal(r.status, 201, value); assert.equal(users[0].emailVerifiedAt, null);
        }
    });
    test('and any other value, or none at all, means verification is required', async () => {
        for (const value of [undefined, 'true', '', '0', 'no']) {
            if (value === undefined) delete process.env.EMAIL_VERIFICATION_REQUIRED; else process.env.EMAIL_VERIFICATION_REQUIRED = value;
            assert.equal((await post('/register', signupBody())).status, 400, String(value));
        }
    });
    test('a password-reset code cannot be used to verify a signup', async () => {
        addUser({ email: 'sam@example.com' });
        await post('/forgot-password', { email: 'sam@example.com' });
        const r = await post('/register/verify-otp', { email: 'sam@example.com', code: lastCode() });
        assert.equal(r.status, 400);
    });
});

describe('password reset: asking for a code', () => {
    test('the answer is identical whether or not the account exists', async () => {
        addUser();
        const known = await post('/forgot-password', { email: 'eve@example.com' });
        const unknown = await post('/forgot-password', { email: 'nobody@example.com' });
        assert.equal(known.status, 200); assert.deepEqual(known, unknown);
    });
    test('only a real account is emailed, with a reset-purpose code and its own name', async () => {
        addUser();
        await post('/forgot-password', { email: 'nobody@example.com' });
        assert.equal(inbox.codes.length, 0);
        await post('/forgot-password', { email: ' EVE@example.com ' });
        assert.equal(inbox.codes.length, 1);
        assert.deepEqual([inbox.codes[0].email, inbox.codes[0].name, inbox.codes[0].purpose], ['eve@example.com', 'Existing Eve', 'reset']);
    });
    test('a missing email is a plain 400; a malformed one gets the generic answer', async () => {
        assert.equal((await post('/forgot-password', {})).status, 400);
        const r = await post('/forgot-password', { email: 'not-an-email' });
        assert.equal(r.status, 200); assert.equal(inbox.codes.length, 0);
    });
    test('asking again too soon looks exactly the same but sends nothing (so it cannot reveal the account)', async () => {
        addUser();
        const first = await post('/forgot-password', { email: 'eve@example.com' });
        const second = await post('/forgot-password', { email: 'eve@example.com' });
        assert.deepEqual(first, second); assert.equal(inbox.codes.length, 1);
        advance(61);
        await post('/forgot-password', { email: 'eve@example.com' });
        assert.equal(inbox.codes.length, 2);
    });
    test('the hourly limit is also silent', async () => {
        addUser();
        for (let i = 0; i < 6; i++) { const r = await post('/forgot-password', { email: 'eve@example.com' }); assert.equal(r.status, 200); advance(61); }
        assert.equal(inbox.codes.length, 5);
    });
    test('a provider outage is reported, and the person can try again straight away', async () => {
        addUser();
        inbox.failNext = true;
        assert.equal((await post('/forgot-password', { email: 'eve@example.com' })).status, 502);
        assert.equal((await post('/forgot-password', { email: 'eve@example.com' })).status, 200);
        assert.equal(inbox.codes.length, 1);
    });
});

describe('password reset: code, then new password', () => {
    test('the whole journey, and the code and the token are each single-use', async () => {
        const eve = addUser();
        await post('/forgot-password', { email: 'eve@example.com' });
        const code = lastCode();
        const verified = await post('/forgot-password/verify-otp', { email: 'eve@example.com', code });
        assert.equal(verified.status, 200); assert.match(verified.json.resetToken, /^[0-9a-f]{64}$/);
        assert.equal((await post('/forgot-password/verify-otp', { email: 'eve@example.com', code })).status, 400, 'code reused');

        const reset = await post('/reset-password', { token: verified.json.resetToken, password: 'brand-new-pass' });
        assert.equal(reset.status, 200); assert.ok(reset.json.token);
        assert.equal(eve.password, 'brand-new-pass');
        assert.equal((await post('/reset-password', { token: verified.json.resetToken, password: 'another-one' })).status, 400, 'token reused');
        assert.equal(eve.password, 'brand-new-pass');
    });
    test('a wrong code counts down, five lock it, and then even the right code is refused', async () => {
        addUser();
        await post('/forgot-password', { email: 'eve@example.com' });
        const real = lastCode(); const bad = real === '000000' ? '111111' : '000000';
        assert.equal((await post('/forgot-password/verify-otp', { email: 'eve@example.com', code: bad })).json.attemptsLeft, 4);
        for (let i = 0; i < 4; i++) await post('/forgot-password/verify-otp', { email: 'eve@example.com', code: bad });
        const locked = await post('/forgot-password/verify-otp', { email: 'eve@example.com', code: real });
        assert.equal(locked.status, 429); assert.ok(!locked.json.resetToken);
    });
    test('an unknown email cannot be told apart from an account that never asked for a code', async () => {
        addUser();
        const noAccount = await post('/forgot-password/verify-otp', { email: 'nobody@example.com', code: '123456' });
        const noRequest = await post('/forgot-password/verify-otp', { email: 'eve@example.com', code: '123456' });
        assert.equal(noAccount.status, 400); assert.deepEqual(noAccount, noRequest);
    });
    test('malformed input is rejected before any guess is used', async () => {
        addUser();
        await post('/forgot-password', { email: 'eve@example.com' });
        for (const code of ['', '123', 'abcdef', undefined]) assert.equal((await post('/forgot-password/verify-otp', { email: 'eve@example.com', code })).status, 400);
        assert.equal((await post('/forgot-password/verify-otp', { email: 'eve@example.com', code: '000000' })).json.attemptsLeft ?? 4, 4);
    });
    test('an expired code is refused', async () => {
        addUser();
        await post('/forgot-password', { email: 'eve@example.com' });
        advance(11 * 60);
        const r = await post('/forgot-password/verify-otp', { email: 'eve@example.com', code: lastCode() });
        assert.equal(r.status, 400); assert.equal(r.json.code, 'expired');
    });
    test('a signup code cannot reset a password', async () => {
        addUser({ email: 'sam@example.com' });
        users.length = 0;                                     // no account yet: sign-up is allowed to request a code
        await post('/register/request-otp', { email: 'sam@example.com' });
        const signupCode = lastCode();
        addUser({ email: 'sam@example.com' });                // the account appears
        const r = await post('/forgot-password/verify-otp', { email: 'sam@example.com', code: signupCode });
        assert.equal(r.status, 400); assert.ok(!r.json.resetToken);
    });
    test('reset links that were already emailed before this change still work', async () => {
        const eve = addUser();
        const legacy = eve.createPasswordResetToken();
        assert.equal((await post('/reset-password', { token: legacy, password: 'via-old-link' })).status, 200);
        assert.equal(eve.password, 'via-old-link');
    });
    test('the new password must still be at least six characters', async () => {
        const eve = addUser();
        const token = eve.createPasswordResetToken();
        assert.equal((await post('/reset-password', { token, password: '123' })).status, 400);
        assert.equal(eve.password, 'oldpass');
    });
});
