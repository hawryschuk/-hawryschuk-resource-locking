const FileMutex = require('./file.mutex');
const test = require('./mutex.spec.exports');
test('FileMutex', () => new FileMutex({ resource: 's' }));
