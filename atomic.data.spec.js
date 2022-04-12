const AtomicData = require('./atomic.data');
const test = require('./atomic.data.spec.exports');
test('AtomicData', new AtomicData({ resource: 'r' }));
