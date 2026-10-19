const { test, describe } = require('node:test');
const assert = require('node:assert/strict');
const { sendViaBrevo, EmailSendError, BREVO_URL } = require('../src/services/brevoClient');

const ok = (json = { messageId: '<abc@smtp-relay.mailin.fr>' }) => ({ ok: true, status: 201, headers: { get: () => null }, json: async () => json });
const fail = (status, json = {}, headers = {}) => ({ ok: false, status, statusText: 'err', headers: { get: (k) => headers[k.toLowerCase()] ?? null }, json: async () => json });
const base = { apiKey: 'xkeysib-SECRET-KEY', sender: { name: 'TrueOdds', email: 'no-reply@trueodds.ca' }, to: 'fan@example.com', subject: 'Hi', html: '<p>Hello</p>', text: 'Hello', sleep: async () => {} };

function fakeFetch(...responses) {
    const calls = [];
    const fn = async (url, init) => {
        calls.push({ url, init, body: JSON.parse(init.body) });
        const next = responses[Math.min(calls.length - 1, responses.length - 1)];
        if (next instanceof Error) throw next;
        return next;
    };
    fn.calls = calls;
    return fn;
}

describe('request shape', () => {
    test('posts to the Brevo endpoint with the key in a header, never in the body', async () => {
        const f = fakeFetch(ok());
        const r = await sendViaBrevo({ ...base, fetchImpl: f });
        assert.equal(r.messageId, '<abc@smtp-relay.mailin.fr>');
        const c = f.calls[0];
        assert.equal(c.url, BREVO_URL);
        assert.equal(c.init.method, 'POST');
        assert.equal(c.init.headers['api-key'], 'xkeysib-SECRET-KEY');
        assert.equal(c.init.headers['content-type'], 'application/json');
        assert.ok(!c.init.body.includes('SECRET-KEY'));
        assert.deepEqual(c.body, { sender: base.sender, to: [{ email: 'fan@example.com' }], subject: 'Hi', htmlContent: '<p>Hello</p>', textContent: 'Hello' });
    });

    test('reply-to and tags are included when given, omitted otherwise', async () => {
        const f = fakeFetch(ok());
        await sendViaBrevo({ ...base, fetchImpl: f, replyTo: { email: 'support@trueodds.ca', name: 'Support' }, tags: ['otp'] });
        assert.deepEqual(f.calls[0].body.replyTo, { email: 'support@trueodds.ca', name: 'Support' });
        assert.deepEqual(f.calls[0].body.tags, ['otp']);
        const g = fakeFetch(ok());
        await sendViaBrevo({ ...base, fetchImpl: g });
        assert.ok(!('replyTo' in g.calls[0].body) && !('tags' in g.calls[0].body));
    });

    test('recipients can be a string, an object or a list of either (one entry per address, never "a, b")', async () => {
        const f = fakeFetch(ok());
        await sendViaBrevo({ ...base, fetchImpl: f, to: ['a@x.com', { email: 'b@x.com', name: 'Bee' }] });
        assert.deepEqual(f.calls[0].body.to, [{ email: 'a@x.com' }, { email: 'b@x.com', name: 'Bee' }]);
    });

    test('text-only and html-only emails are both fine', async () => {
        const f = fakeFetch(ok());
        await sendViaBrevo({ ...base, fetchImpl: f, html: undefined });
        assert.ok(!('htmlContent' in f.calls[0].body) && f.calls[0].body.textContent === 'Hello');
    });
});

describe('failures that are not worth retrying', () => {
    for (const [status, code, message] of [[401, 'unauthorized', 'Key not found'], [400, 'invalid_parameter', 'Sender is not valid'], [403, 'permission_denied', 'Forbidden']]) {
        test(`${status} is reported once, with Brevo's own explanation`, async () => {
            const f = fakeFetch(fail(status, { code, message }));
            await assert.rejects(sendViaBrevo({ ...base, fetchImpl: f }), (e) => {
                assert.ok(e instanceof EmailSendError);
                assert.equal(e.status, status); assert.equal(e.code, code); assert.equal(e.retryable, false);
                assert.ok(e.message.includes(message) && e.message.includes(String(status)));
                assert.ok(!e.message.includes('SECRET-KEY'));
                return true;
            });
            assert.equal(f.calls.length, 1);
        });
    }
});

describe('retries', () => {
    test('429 is retried, and Retry-After is honoured', async () => {
        const f = fakeFetch(fail(429, {}, { 'retry-after': '1' }), ok());
        const waits = [];
        const r = await sendViaBrevo({ ...base, fetchImpl: f, sleep: async (ms) => waits.push(ms) });
        assert.equal(f.calls.length, 2); assert.equal(r.messageId, '<abc@smtp-relay.mailin.fr>'); assert.deepEqual(waits, [1000]);
    });

    test('a long Retry-After never stalls the request for more than 5 seconds', async () => {
        const waits = [];
        await sendViaBrevo({ ...base, fetchImpl: fakeFetch(fail(429, {}, { 'retry-after': '120' }), ok()), sleep: async (ms) => waits.push(ms) });
        assert.deepEqual(waits, [5000]);
    });

    test('5xx is retried and succeeds on the third try', async () => {
        const f = fakeFetch(fail(503), fail(500), ok());
        await sendViaBrevo({ ...base, fetchImpl: f });
        assert.equal(f.calls.length, 3);
    });

    test('gives up after the retries are used and says why', async () => {
        const f = fakeFetch(fail(500, { code: 'server_error', message: 'boom' }));
        await assert.rejects(sendViaBrevo({ ...base, fetchImpl: f }), (e) => e.status === 500 && e.retryable === true && /boom/.test(e.message));
        assert.equal(f.calls.length, 3);
    });

    test('network errors are retried, then reported as network', async () => {
        const f = fakeFetch(new TypeError('fetch failed'), ok());
        await sendViaBrevo({ ...base, fetchImpl: f });
        assert.equal(f.calls.length, 2);
        const g = fakeFetch(new TypeError('fetch failed'));
        await assert.rejects(sendViaBrevo({ ...base, fetchImpl: g }), (e) => e.code === 'network' && /fetch failed/.test(e.message));
    });

    test('a hung connection is cut off at the timeout', async () => {
        const hang = (url, init) => new Promise((_, reject) => init.signal.addEventListener('abort', () => reject(Object.assign(new Error('aborted'), { name: 'AbortError' }))));
        const started = Date.now();
        await assert.rejects(sendViaBrevo({ ...base, fetchImpl: hang, timeoutMs: 30, retries: 0 }), (e) => e.code === 'timeout');
        assert.ok(Date.now() - started < 1000);
    });
});

describe('bad input is rejected before anything is sent', () => {
    for (const [name, patch, code] of [
        ['no key', { apiKey: '' }, 'not_configured'],
        ['no recipient', { to: '' }, 'invalid_recipient'],
        ['empty recipient list', { to: [] }, 'invalid_recipient'],
        ['no sender', { sender: {} }, 'not_configured'],
        ['no content', { html: '', text: '' }, 'invalid_content'],
    ]) {
        test(name, async () => {
            const f = fakeFetch(ok());
            await assert.rejects(sendViaBrevo({ ...base, ...patch, fetchImpl: f }), (e) => e.code === code);
            assert.equal(f.calls.length, 0);
        });
    }
});
