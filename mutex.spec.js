const testMutex = require('./mutex.spec.exports');
const Mutex = require('./mutex');
testMutex('Mutex', () => new Mutex({ resource: 'r' }));
