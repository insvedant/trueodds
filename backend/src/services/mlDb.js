const mongoose = require('mongoose');
let mlConnection = null;
let readyPromise = null;
function getMlConnection() {
    if (mlConnection)
        return mlConnection;
    const uri = process.env.ML_MONGODB_URI;
    if (!uri) {
        console.warn('[MLDB] ML_MONGODB_URI not set — Line Movement / Steam / CLV tools will return empty data until it is configured.');
        return null;
    }
    mlConnection = mongoose.createConnection(uri, { serverSelectionTimeoutMS: 5000 });
    mlConnection.on('error', err => console.warn('[MLDB] connection error:', err.message));
    // createConnection() returns immediately, before the connection is actually
    // established — calling .collection() and querying it right away (the bug
    // that was here before) silently returns a stub that doesn't behave like a
    // real collection. asPromise() resolves only once truly connected.
    readyPromise = mlConnection.asPromise().catch(err => {
        console.warn('[MLDB] failed to connect:', err.message);
        return null;
    });
    return mlConnection;
}
// Now async — always await this before querying. Waits for the connection to
// be genuinely ready instead of returning a not-yet-connected stub.
async function mlCollection(name) {
    const conn = getMlConnection();
    if (!conn)
        return null;
    await readyPromise;
    if (conn.readyState !== 1)
        return null; // 1 = connected
    return conn.useDb('trueodds', { useCache: true }).collection(name);
}
module.exports = { getMlConnection, mlCollection };
