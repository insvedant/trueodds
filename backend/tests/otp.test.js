const { test, describe, beforeEach } = require('node:test');
const assert = require('node:assert/strict');
const jwt = require('jsonwebtoken');
const { createOtpService, OtpError } = require('../src/services/otpService');
const { memoryStore } = require('../src/services/otpStore');

const SECRET = 'unit-test-secret';
const MIN = 60 * 1000;
let clock, store, svc, nextCode;
beforeEach(() => {
    clock = { t: 1_700_000_000_000 };
    store = memoryStore();
    nextCode = 123456;
    svc = createOtpService({ store, now: () => clock.t, secret: () => SECRET, random: () => nextCode });
});
const expectCode = (promise, code, extra = {}) => assert.rejects(promise, (e) => { assert.ok(e instanceof OtpError, String(e)); assert.equal(e.code, code); for (const [k, v] of Object.entries(extra)) assert.equal(e[k], v, k); return true; });
const issue = (over = {}) => svc.issue({ email: 'a@x.com', purpose: 'register', ...over });
const verify = (code, over = {}) => svc.verify({ email: 'a@x.com', purpose: 'register', code, ...over });

describe('issuing a code', () => {
    test('is six digits, with leading zeros kept, valid for ten minutes', async () => {
        nextCode = 42;
        const r = await issue();
        assert.equal(r.code, '000042'); assert.equal(r.expiresInSeconds, 600);
    });
    test('the real random source only ever produces six digits', async () => {
        const real = createOtpService({ store: memoryStore(), secret: () => SECRET });
        for (let i = 0; i < 40; i++) {
            const { code } = await real.issue({ email: `u${i}@x.com`, purpose: 'register' });
            assert.match(code, /^\d{6}$/);
        }
    });
    test('only a keyed hash is stored, never the code, and the hash depends on email and purpose', async () => {
        const { code } = await issue();
        const row = [...store.rows.values()][0];
        assert.ok(!JSON.stringify(row).includes(code));
        assert.match(row.codeHash, /^[0-9a-f]{64}$/);
        await issue({ email: 'b@x.com' });
        await issue({ purpose: 'reset' });
        const hashes = [...store.rows.values()].map((r) => r.codeHash);
        assert.equal(new Set(hashes).size, 3, 'same code, different email/purpose must hash differently');
    });
    test('refuses to work without a secret rather than hashing with an empty key', async () => {
        const broken = createOtpService({ store, secret: () => undefined });
        await assert.rejects(broken.issue({ email: 'a@x.com', purpose: 'register' }), /OTP_SECRET or JWT_SECRET/);
    });
});

describe('checking a code', () => {
    test('the right code works once and only once', async () => {
        const { code } = await issue();
        assert.equal(await verify(code), true);
        await expectCode(verify(code), 'not_found');
    });
    test('spaces around the code and capital letters in the email are forgiven', async () => {
        const { code } = await svc.issue({ email: ' A@X.com ', purpose: 'register' });
        assert.equal(await verify(` ${code} `), true);
    });
    test('a wrong code says how many guesses are left, then locks', async () => {
        await issue();
        for (const left of [4, 3, 2, 1]) await expectCode(verify('000000'), 'invalid', { attemptsLeft: left });
        await expectCode(verify('000000'), 'locked', { attemptsLeft: 0 });
    });
    test('once locked, even the correct code is refused', async () => {
        const { code } = await issue();
        for (let i = 0; i < 5; i++) await verify('000000').catch(() => {});
        await expectCode(verify(code), 'locked');
    });
    test('the correct code still works on the fifth and last guess', async () => {
        const { code } = await issue();
        for (let i = 0; i < 4; i++) await verify('000000').catch(() => {});
        assert.equal(await verify(code), true);
    });
    test('a code expires after ten minutes', async () => {
        const { code } = await issue();
        clock.t += 10 * MIN - 1000;
        const again = await svc.issue({ email: 'z@x.com', purpose: 'register' });   // unrelated; makes sure nothing global expires early
        assert.ok(again.code);
        assert.equal(await verify(code), true);
        const second = await issue({ email: 'c@x.com' });
        clock.t += 10 * MIN + 1000;
        await expectCode(verify(second.code, { email: 'c@x.com' }), 'expired');
    });
    test('nothing outstanding means not_found', async () => {
        await expectCode(verify('123456'), 'not_found');
    });
    test('garbage input is just a wrong code, not a crash', async () => {
        await issue();
        for (const bad of [undefined, null, '', '   ', 12345, { $ne: 1 }, [], 'abc']) await verify(bad).catch((e) => assert.ok(e instanceof OtpError));
    });
});

describe('a code only works where it was issued', () => {
    test('a signup code cannot reset a password, and the other way round', async () => {
        nextCode = 111111; const a = await issue({ purpose: 'register' });
        nextCode = 222222; const b = await svc.issue({ email: 'a@x.com', purpose: 'reset' });
        await expectCode(svc.verify({ email: 'a@x.com', purpose: 'reset', code: a.code }), 'invalid');   // both exist; wrong code for this purpose
        assert.equal(await svc.verify({ email: 'a@x.com', purpose: 'reset', code: b.code }), true);
        assert.equal(await verify(a.code), true);
    });
    test("one person's code is useless for another email", async () => {
        nextCode = 111111; const mine = await issue({ email: 'me@x.com' });
        nextCode = 222222; await issue({ email: 'victim@x.com' });
        await expectCode(svc.verify({ email: 'victim@x.com', purpose: 'register', code: mine.code }), 'invalid');
    });
});

describe('asking for codes', () => {
    test('another code cannot be requested for 60 seconds, and the wait is reported', async () => {
        await issue();
        await expectCode(issue(), 'cooldown', { retryAfterSeconds: 60 });
        clock.t += 25 * 1000;
        await expectCode(issue(), 'cooldown', { retryAfterSeconds: 35 });
        clock.t += 36 * 1000;
        assert.ok((await issue()).code);
    });
    test('a new code replaces the old one', async () => {
        nextCode = 111111; const first = await issue();
        clock.t += 61 * 1000; nextCode = 222222; const second = await issue();
        await expectCode(verify(first.code), 'invalid');
        assert.equal(await verify(second.code), true);
    });
    test('a new code starts again with five guesses', async () => {
        await issue();
        for (let i = 0; i < 4; i++) await verify('000000').catch(() => {});
        clock.t += 61 * 1000;
        const { code } = await issue();
        await expectCode(verify('000000'), 'invalid', { attemptsLeft: 4 });
        assert.equal(await verify(code), true);
    });
    test('at most five codes an hour per email and purpose', async () => {
        for (let i = 0; i < 5; i++) { await issue(); clock.t += 61 * 1000; }
        await expectCode(issue(), 'rate_limited');
        await assert.doesNotReject(issue({ purpose: 'reset' }));       // a different purpose has its own allowance
        await assert.doesNotReject(issue({ email: 'other@x.com' }));   // so does another email
        clock.t += 60 * MIN;
        await assert.doesNotReject(issue());
    });
    test('the rate-limit message says how long to wait', async () => {
        for (let i = 0; i < 5; i++) { await issue(); clock.t += 61 * 1000; }
        await assert.rejects(issue(), (e) => e.code === 'rate_limited' && e.retryAfterSeconds > 0 && e.retryAfterSeconds <= 3600);
    });
    test('discarding (the email failed to send) clears the cooldown so the person can retry at once', async () => {
        await issue();
        await svc.discard({ email: 'a@x.com', purpose: 'register' });
        assert.ok((await issue()).code);
    });
});

describe('guessing in parallel', () => {
    test('twenty simultaneous guesses still only get five looks, and the right code is then refused', async () => {
        const { code } = await issue();
        const results = await Promise.allSettled(Array.from({ length: 20 }, () => verify('000000')));
        const codes = results.map((r) => r.reason?.code);
        assert.ok(codes.filter((c) => c === 'invalid' || (c === 'locked' && true)).length === 20);
        assert.equal([...store.rows.values()][0].attempts, 5);
        await expectCode(verify(code), 'locked');
    });
    test('the correct code racing against wrong ones succeeds at most once', async () => {
        const { code } = await issue();
        const results = await Promise.allSettled([verify(code), verify(code), verify(code)]);
        assert.equal(results.filter((r) => r.status === 'fulfilled').length, 1);
    });
});

describe('proof that an email was verified', () => {
    test('a token works for exactly the address it was issued for', () => {
        const token = svc.issueVerificationToken({ email: 'A@X.com' });
        assert.deepEqual(svc.checkVerificationToken({ email: 'a@x.com', token }), { ok: true });
        assert.deepEqual(svc.checkVerificationToken({ email: 'someone-else@x.com', token }), { ok: false, reason: 'wrong_email' });
    });
    test('missing or malformed tokens are refused', () => {
        for (const token of [undefined, null, '', 'abc', 12345, {}, 'a.b.c']) assert.equal(svc.checkVerificationToken({ email: 'a@x.com', token }).ok, false);
    });
    test('a forged, re-signed or unsigned token is refused', () => {
        const forged = jwt.sign({ email: 'a@x.com', purpose: 'signup-email-verified' }, 'attacker-secret');
        assert.deepEqual(svc.checkVerificationToken({ email: 'a@x.com', token: forged }), { ok: false, reason: 'invalid' });
        const unsigned = [Buffer.from('{"alg":"none","typ":"JWT"}').toString('base64url'), Buffer.from(JSON.stringify({ email: 'a@x.com', purpose: 'signup-email-verified' })).toString('base64url'), ''].join('.');
        assert.equal(svc.checkVerificationToken({ email: 'a@x.com', token: unsigned }).ok, false);
    });
    test('an expired token is refused and reported as expired', () => {
        const old = jwt.sign({ email: 'a@x.com', purpose: 'signup-email-verified' }, SECRET, { expiresIn: -10 });
        assert.deepEqual(svc.checkVerificationToken({ email: 'a@x.com', token: old }), { ok: false, reason: 'expired' });
    });
    test('a token signed for some other purpose (e.g. a login token) cannot stand in for it', () => {
        const login = jwt.sign({ id: 'user-1' }, SECRET, { expiresIn: '30d' });
        assert.equal(svc.checkVerificationToken({ email: 'a@x.com', token: login }).ok, false);
        const wrong = jwt.sign({ email: 'a@x.com', purpose: 'login' }, SECRET);
        assert.deepEqual(svc.checkVerificationToken({ email: 'a@x.com', token: wrong }), { ok: false, reason: 'wrong_purpose' });
    });
    test('the token lasts thirty minutes', () => {
        const { exp, iat } = jwt.decode(svc.issueVerificationToken({ email: 'a@x.com' }));
        assert.equal(exp - iat, 30 * 60);
    });
});
