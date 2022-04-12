const AtomicS3 = require('./atomic.s3');
const test = require('./atomic.data.spec.exports');
test('AtomicS3', new AtomicS3({ Bucket: 'resource-locking', LockTable: 'test', Key: 'test1' }));
