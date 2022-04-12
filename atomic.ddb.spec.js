const AtomicDDB = require('./atomic.ddb');
const test = require('./atomic.data.spec.exports');
const aws = require('./aws.helper');

before(async () => { await aws.Helpers.DynamoDB.clear({ TableName: 'test', Key: 'resourceName' }); });

test('AtomicDDB', new AtomicDDB({ resource: 'test1', TableName: 'test' }));
