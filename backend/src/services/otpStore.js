/**
 * Storage for one-time codes. otpService only talks to this interface, so its rules can be tested with the
 * in-memory version and run in production on MongoDB.
 *
 *   get(email, purpose)                       -> record | null
 *   save(record)                              -> upsert by (email, purpose)
 *   remove(email, purpose)
 *   consume(email, purpose, codeHash)         -> true for exactly ONE caller: deletes the row if it still holds that code
 *   claimAttempt(email, purpose, max, nowMs)  -> { record } after atomically counting one guess, or { reason }
 *                                                where reason is 'not_found' | 'expired' | 'locked'
 *
 * claimAttempt is ATOMIC on purpose: the guess is counted before the code is compared, in one database
 * operation, so firing many guesses in parallel cannot get more than `max` of them looked at.
 */
const mongoStore = {
    model() { return require('../models/EmailOtp'); },

    async get(email, purpose) {
        return this.model().findOne({ email, purpose }).lean();
    },

    async save(record) {
        const { email, purpose, ...fields } = record;
        await this.model().findOneAndUpdate({ email, purpose }, { $set: fields, $setOnInsert: { email, purpose } }, { upsert: true, new: true });
    },

    async remove(email, purpose) {
        await this.model().deleteOne({ email, purpose });
    },

    async consume(email, purpose, codeHash) {
        return !!(await this.model().findOneAndDelete({ email, purpose, codeHash }));
    },

    async claimAttempt(email, purpose, max, nowMs) {
        const Model = this.model();
        const claimed = await Model.findOneAndUpdate(
            { email, purpose, codeHash: { $ne: null }, expiresAt: { $gt: new Date(nowMs) }, attempts: { $lt: max } },
            { $inc: { attempts: 1 } },
            { new: true },
        ).lean();
        if (claimed) return { record: claimed };
        const existing = await Model.findOne({ email, purpose }).lean();
        if (!existing || !existing.codeHash) return { reason: 'not_found' };
        if (new Date(existing.expiresAt).getTime() <= nowMs) return { reason: 'expired' };
        return { reason: 'locked' };
    },
};

/** Same behaviour in memory (used by the tests). */
function memoryStore() {
    const rows = new Map();
    const key = (email, purpose) => `${purpose}:${email}`;
    const copy = (r) => (r ? { ...r } : null);
    return {
        rows,
        async get(email, purpose) { return copy(rows.get(key(email, purpose))); },
        async save(record) { rows.set(key(record.email, record.purpose), { ...record }); },
        async remove(email, purpose) { rows.delete(key(email, purpose)); },
        async consume(email, purpose, codeHash) {
            const rec = rows.get(key(email, purpose));
            if (!rec || rec.codeHash !== codeHash) return false;
            rows.delete(key(email, purpose));                // check and delete with no await between: only one caller can win
            return true;
        },
        async claimAttempt(email, purpose, max, nowMs) {
            const rec = rows.get(key(email, purpose));
            if (!rec || !rec.codeHash) return { reason: 'not_found' };
            if (new Date(rec.expiresAt).getTime() <= nowMs) return { reason: 'expired' };
            if (rec.attempts >= max) return { reason: 'locked' };
            rec.attempts += 1;                       // no await between the check and the write: atomic, like the Mongo update
            return { record: { ...rec } };
        },
    };
}

module.exports = { mongoStore, memoryStore };
