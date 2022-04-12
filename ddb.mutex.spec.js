const DDBMutex = require('./ddb.mutex');
const test = require('./mutex.spec.exports');
test('DDBMutex', () => new DDBMutex({ resource: 's', TableName: 'test' }));
