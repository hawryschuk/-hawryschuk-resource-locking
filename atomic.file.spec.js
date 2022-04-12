const AtomicFile = require('./atomic.file');
const test = require('./atomic.data.spec.exports');
test('AtomicFile', new AtomicFile({ filename: 'test.json' }));
