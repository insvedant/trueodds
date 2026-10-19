/**
 * Checks the one-time-code storage against your REAL MongoDB. It sends no email and uses throw-away
 * addresses (smoke-*@example.invalid) that it deletes afterwards.
 *
 *     cd backend && npm run otp:smoke
 *
 * Every line should say PASS. If any says FAIL, do not switch signup verification on; send me the output.
 */
require('dotenv').config();
const mongoose = require('mongoose');
const { createOtpService, OtpError } = require('../src/services/otpService');
const { mongoStore } = require('../src/services/otpStore');
const EmailOtp = require('../src/models/EmailOtp');

let failures = 0;
const check = (name, ok, detail = '') => { console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${ok ? '' : `  ${detail}`}`); if (!ok) failures++; };
const code = async (p) => { try { await p; return 'ok'; } catch (e) { return e instanceof OtpError ? e.code : `ERROR:${e.message}`; } };
const tag = Date.now();
const email = (n) => `smoke-${tag}-${n}@example.invalid`;

(async () => {
    if (!process.env.MONGODB_URI) { console.error('MONGODB_URI is not set (backend/.env).'); process.exit(2); }
    await mongoose.connect(process.env.MONGODB_URI);
    await EmailOtp.init();                                           // builds the indexes if they are missing
    const svc = createOtpService({ store: mongoStore });
    const purpose = 'register';
    try {
        const idx = await EmailOtp.collection.indexes();
        check('unique index on (email, purpose)', idx.some((i) => i.unique && i.key.email === 1 && i.key.purpose === 1));
        check('self-deleting (TTL) index on purgeAt', idx.some((i) => i.key.purgeAt === 1 && i.expireAfterSeconds === 0));

        const a = email('a');
        const issued = await svc.issue({ email: a, purpose });
        check('issues a six-digit code', /^\d{6}$/.test(issued.code));
        const row = await EmailOtp.findOne({ email: a, purpose }).lean();
        check('stores a hash, never the code', !!row && !JSON.stringify(row).includes(issued.code) && /^[0-9a-f]{64}$/.test(row.codeHash));
        check('refuses a second code within a minute', (await code(svc.issue({ email: a, purpose }))) === 'cooldown');
        const bad = issued.code === '000000' ? '111111' : '000000';
        const wrong = [];
        for (let i = 0; i < 5; i++) wrong.push(await code(svc.verify({ email: a, purpose, code: bad })));
        check('four wrong guesses are "invalid", the fifth locks', wrong.join() === 'invalid,invalid,invalid,invalid,locked', wrong.join());
        check('the right code is refused once locked', (await code(svc.verify({ email: a, purpose, code: issued.code }))) === 'locked');

        const b = email('b');
        const second = await svc.issue({ email: b, purpose });
        check('the right code is accepted', (await code(svc.verify({ email: b, purpose, code: second.code }))) === 'ok');
        check('and cannot be used again', (await code(svc.verify({ email: b, purpose, code: second.code }))) === 'not_found');

        const c = email('c');
        const third = await svc.issue({ email: c, purpose });
        const raced = await Promise.all([1, 2, 3, 4].map(() => code(svc.verify({ email: c, purpose, code: third.code }))));
        check('four simultaneous correct submissions: exactly one wins', raced.filter((r) => r === 'ok').length === 1, raced.join());

        const d = email('d');
        const fourth = await svc.issue({ email: d, purpose });
        const later = createOtpService({ store: mongoStore, now: () => Date.now() + 11 * 60 * 1000 });
        check('a code expires after ten minutes', (await code(later.verify({ email: d, purpose, code: fourth.code }))) === 'expired');

        const e = email('e');
        await svc.issue({ email: e, purpose });
        await svc.discard({ email: e, purpose });
        check('discarding clears the cooldown', (await code(svc.issue({ email: e, purpose }))) === 'ok');
    } finally {
        const gone = await EmailOtp.deleteMany({ email: new RegExp(`^smoke-${tag}-`) });
        console.log(`\ncleaned up ${gone.deletedCount} test row(s)`);
        await mongoose.disconnect();
    }
    console.log(failures ? `\n${failures} check(s) FAILED` : '\nAll checks passed.');
    process.exit(failures ? 1 : 0);
})().catch((err) => { console.error('Smoke test crashed:', err.message); process.exit(2); });
