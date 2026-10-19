const { test, describe, beforeEach, afterEach } = require('node:test');
const assert = require('node:assert/strict');

const email = require('../src/services/emailService');

const realFetch = globalThis.fetch;
const envBefore = { ...process.env };
let calls;
function mockBrevo(response) {
    calls = [];
    globalThis.fetch = async (url, init) => {
        calls.push({ url, headers: init.headers, body: JSON.parse(init.body) });
        return response || { ok: true, status: 201, headers: { get: () => null }, json: async () => ({ messageId: '<id@brevo>' }) };
    };
}
beforeEach(() => {
    for (const k of ['BREVO_API_KEY', 'EMAIL_FROM_ADDRESS', 'EMAIL_FROM_NAME', 'EMAIL_REPLY_TO', 'EMAIL_DEV_MODE', 'BULK_EMAIL_DAILY_CAP', 'OWNER_EMAIL', 'SEC_EMAIL', 'ZOHO_USER']) delete process.env[k];
    process.env.NODE_ENV = 'test';
    process.env.BREVO_API_KEY = 'xkeysib-test';
    email.resetBulkBudget();
    mockBrevo();
});
afterEach(() => { globalThis.fetch = realFetch; Object.assign(process.env, envBefore); });

const logSilently = (fn) => async () => { const l = console.log; console.log = () => {}; try { await fn(); } finally { console.log = l; } };

describe('sending', () => {
    test('uses the configured sender and reply-to, with sensible defaults', async () => {
        await email.sendEmail({ to: 'a@x.com', subject: 'S', html: '<p>x</p>' });
        assert.deepEqual(calls[0].body.sender, { name: 'TrueOdds', email: 'no-reply@trueodds.ca' });
        assert.equal(calls[0].body.replyTo.email, 'support@trueodds.ca');
        process.env.EMAIL_FROM_ADDRESS = 'hello@trueodds.us'; process.env.EMAIL_FROM_NAME = 'TrueOdds US'; process.env.EMAIL_REPLY_TO = 'help@trueodds.us';
        await email.sendEmail({ to: 'a@x.com', subject: 'S', html: '<p>x</p>' });
        assert.deepEqual(calls[1].body.sender, { name: 'TrueOdds US', email: 'hello@trueodds.us' });
        assert.equal(calls[1].body.replyTo.email, 'help@trueodds.us');
    });

    test('a Brevo failure reaches the caller, so signup can tell the person', async () => {
        mockBrevo({ ok: false, status: 400, statusText: 'x', headers: { get: () => null }, json: async () => ({ code: 'invalid_parameter', message: 'Sender is not valid' }) });
        await assert.rejects(email.sendEmail({ to: 'a@x.com', subject: 'S', html: 'x' }), /Sender is not valid/);
    });
});

describe('when no API key is set', () => {
    test('production fails loudly instead of pretending the email was sent', async () => {
        delete process.env.BREVO_API_KEY; process.env.NODE_ENV = 'production';
        await assert.rejects(email.sendEmail({ to: 'a@x.com', subject: 'S', html: 'x' }), (e) => e.code === 'not_configured');
        assert.equal(calls.length, 0);
    });
    test('an unset NODE_ENV (as under pm2) is treated as production, not as dev mode', async () => {
        delete process.env.BREVO_API_KEY; delete process.env.NODE_ENV;
        await assert.rejects(email.sendEmail({ to: 'a@x.com', subject: 'S', html: 'x' }), (e) => e.code === 'not_configured');
    });
    test('development prints the email to the console instead (so codes can be read locally)', logSilently(async () => {
        delete process.env.BREVO_API_KEY; process.env.NODE_ENV = 'development';
        assert.deepEqual(await email.sendEmail({ to: 'a@x.com', subject: 'S', html: 'x', text: 'code 123456' }), { success: true, devMode: true });
        assert.equal(calls.length, 0);
    }));
    test('EMAIL_DEV_MODE=true enables the same thing explicitly', logSilently(async () => {
        delete process.env.BREVO_API_KEY; delete process.env.NODE_ENV; process.env.EMAIL_DEV_MODE = 'true';
        assert.equal((await email.sendEmail({ to: 'a@x.com', subject: 'S', html: 'x' })).devMode, true);
    }));
});

describe('the daily bulk cap protects signup and reset codes', () => {
    test('bulk stops at the cap; transactional email still goes out', async () => {
        process.env.BULK_EMAIL_DAILY_CAP = '2';
        const bulk = () => email.sendEmail({ to: 'a@x.com', subject: 'News', html: 'x', category: 'bulk' });
        await bulk(); await bulk();
        await assert.rejects(bulk(), (e) => e.code === 'bulk_cap');
        assert.equal(calls.length, 2);
        await email.sendOtpEmail({ email: 'new@x.com', name: 'N', code: '123456', purpose: 'register' });
        assert.equal(calls.length, 3, 'the code email must still be sent');
    });
    test('the cap only counts bulk email', async () => {
        process.env.BULK_EMAIL_DAILY_CAP = '1';
        for (let i = 0; i < 5; i++) await email.sendEmail({ to: 'a@x.com', subject: 'Receipt', html: 'x' });
        await email.sendEmail({ to: 'a@x.com', subject: 'News', html: 'x', category: 'bulk' });
        assert.equal(calls.length, 6);
    });
    test('emails are tagged so Brevo reports can tell them apart', async () => {
        await email.sendEmail({ to: 'a@x.com', subject: 'News', html: 'x', category: 'bulk' });
        await email.sendEmail({ to: 'a@x.com', subject: 'Receipt', html: 'x' });
        assert.deepEqual(calls[0].body.tags, ['bulk']); assert.deepEqual(calls[1].body.tags, ['transactional']);
    });
});

describe('one-time-code email', () => {
    test('contains the code, the expiry and a clear warning, and no action link', async () => {
        await email.sendOtpEmail({ email: 'new@x.com', name: 'Sam', code: '048213', purpose: 'register' });
        const { body } = calls[0];
        assert.equal(body.subject, 'Your TrueOdds verification code');
        assert.ok(body.htmlContent.includes('048213') && body.textContent.includes('048213'));
        assert.ok(/10 minutes/.test(body.htmlContent) && /10 minutes/.test(body.textContent));
        assert.ok(/never share/i.test(body.htmlContent));
        assert.ok(!/token=|reset-password\?|verify\?/.test(body.htmlContent), 'a code email must not carry a link that does the action');
        assert.deepEqual(body.to, [{ email: 'new@x.com' }]);
        assert.deepEqual(body.tags, ['otp', 'signup']);
    });
    test('the password-reset version is worded and tagged for resetting', async () => {
        await email.sendOtpEmail({ email: 'u@x.com', name: 'Sam', code: '999000', purpose: 'reset' });
        assert.equal(calls[0].body.subject, 'Your TrueOdds password reset code');
        assert.match(calls[0].body.htmlContent, /Reset your password/); assert.deepEqual(calls[0].body.tags, ['otp', 'password-reset']);
    });
    test('the code is never written to the server log', async () => {
        const lines = []; const l = console.log; console.log = (...a) => lines.push(a.join(' '));
        try { await email.sendOtpEmail({ email: 'u@x.com', name: 'Sam', code: '314159', purpose: 'reset' }); } finally { console.log = l; }
        assert.ok(lines.length && lines.every((x) => !x.includes('314159')));
    });
});

describe('text from users cannot inject HTML into our emails', () => {
    const evil = '<img src=x onerror=alert(1)>';
    const assertSafe = (html) => { assert.ok(!html.includes('<img src=x'), 'raw tag leaked'); assert.ok(html.includes('&lt;img src=x')); };
    test('code email', async () => { await email.sendOtpEmail({ email: 'u@x.com', name: evil, code: '111111', purpose: 'register' }); assertSafe(calls[0].body.htmlContent); });
    test('welcome email', async () => { await email.sendWelcomeEmail('u@x.com', evil, 'free'); assertSafe(calls[0].body.htmlContent); });
    test('subscription confirmation', async () => { await email.sendSubscriptionConfirmationEmail('u@x.com', evil, 'gold', 'month', 49); assertSafe(calls[0].body.htmlContent); });
    test('owner alert', async () => {
        process.env.OWNER_EMAIL = 'owner@x.com';
        await email.sendOwnerNewSubscriberAlert({ name: evil, email: 'u@x.com', plan: 'gold', billingPeriod: 'month', price: 49 });
        assertSafe(calls[0].body.htmlContent);
    });
    test('an apostrophe in a name still reads normally in the plain-text part', async () => {
        await email.sendOtpEmail({ email: 'u@x.com', name: "Conan O'Brien", code: '111111', purpose: 'register' });
        assert.ok(calls[0].body.textContent.includes("Conan O'Brien"));
    });
});

describe('welcome email', () => {
    test("makes no promise about a plan name or trial length that isn't known yet", async () => {
        await email.sendWelcomeEmail('u@x.com', 'Sam', 'free');
        const { subject, htmlContent, textContent } = calls[0].body;
        for (const t of [subject, htmlContent, textContent]) { assert.ok(!/7-day|14-day|30-day/i.test(t)); assert.ok(!/undefined|null/.test(t)); }
        assert.match(subject, /Welcome to TrueOdds/); assert.match(htmlContent, /Sam/);
    });
    test('works with no plan at all', async () => { await email.sendWelcomeEmail('u@x.com', 'Sam'); assert.equal(calls.length, 1); });
});

describe('owner alerts', () => {
    test('go to each owner address once, as separate recipients', async () => {
        process.env.OWNER_EMAIL = 'owner@x.com'; process.env.SEC_EMAIL = 'second@x.com'; process.env.ZOHO_USER = 'owner@x.com ';
        await email.sendOwnerNewSubscriberAlert({ name: 'Sam', email: 's@x.com', plan: 'gold', billingPeriod: 'month', price: 49 });
        assert.deepEqual(calls[0].body.to, [{ email: 'owner@x.com' }, { email: 'second@x.com' }]);
    });
    test('with nobody configured it skips quietly', async () => {
        const w = console.warn; console.warn = () => {};
        try { assert.deepEqual(await email.sendOwnerNewSubscriberAlert({ name: 'S', email: 's@x.com', plan: 'gold', billingPeriod: 'month', price: 1 }), { success: false, skipped: true }); } finally { console.warn = w; }
        assert.equal(calls.length, 0);
    });
    test('the old Zoho variable still works as an owner address', async () => {
        process.env.ZOHO_USER = 'support@trueodds.ca';
        await email.sendOwnerNewSubscriberAlert({ name: 'S', email: 's@x.com', plan: 'gold', billingPeriod: 'month', price: 1 });
        assert.deepEqual(calls[0].body.to, [{ email: 'support@trueodds.ca' }]);
    });
});
