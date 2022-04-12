const {Util }=require('@hawryschuk/common');
const Mutex = require('./mutex');
const awshelper = require('./aws.helper');
/** A mutex lock stored in the DynamoDB No-SQL Data-Store */
module.exports = class DDBMutex extends Mutex {
  static key({ resource, TableName }) { return `ddb://${TableName}/${resource}` }
  constructor({ resource, pause, TableName, retries }) {
    super({ resource, pause, retries });
    Object.assign(this, { TableName });
  }
  get record() {
    const { resource: resourceName, TableName } = this;
    return Util.timeIt({
      logger: ({ ms }) => { }, // Util.log(`${ms}ms to get ddb record`),
      block: () => awshelper
        .DocumentClient.get({ TableName, Key: { resourceName } }).promise()
        .then(r => Util.safely(() => r.Item))
    }).then(timeit => timeit.result);
  }
  get exists() { return this.record; }
  get locked() { return this.record.then(v => v ? v.lock : undefined); }
  async acquire({ user = Util.UUID } = {}) {
    const { TableName, resource: resourceName } = this;
    await Util.timeIt({
      logger: ({ ms }) => { }, // Util.log(`${ms}ms to update ddb lock`),
      block: () => awshelper.DocumentClient.update({
        TableName,
        Key: { resourceName },
        UpdateExpression: 'set #lock = :lock',
        ConditionExpression: 'attribute_not_exists(resourceName) or (attribute_not_exists(#lock) or #lock = :lock)',
        ExpressionAttributeNames: { '#lock': 'lock' },
        ExpressionAttributeValues: { ':lock': user },
        ReturnValues: 'ALL_OLD'
      }).promise()
    });
    return user;
  }
  async release({ user }) {
    const userWithLock = await this.locked;
    const { resource: resourceName, TableName } = this;
    if (userWithLock !== user) throw new Error(`${user} cannot release the lock owned by ${userWithLock}`);
    await Util.timeIt({
      logger: ({ ms }) => { }, // Util.log(`${ms}ms to remove the ddb lock`),
      block: () => awshelper.DocumentClient.update({
        TableName,
        Key: { resourceName },
        UpdateExpression: 'REMOVE #lock',
        ConditionExpression: 'attribute_exists(resourceName) and #lock = :lock',
        ExpressionAttributeNames: { '#lock': 'lock' },
        ExpressionAttributeValues: { ':lock': user }
      }).promise()
    });
    if ([null, undefined].includes((await this.record).data)) await this.delete();
  }
  async delete() {
    const { TableName, resource: resourceName } = this;
    await Util.timeIt({
      logger: ({ ms }) => { }, // Util.log(`${ms}ms to delete ddb lock record`),
      block: () => awshelper.DocumentClient.delete({
        TableName,
        Key: { resourceName },
        ConditionExpression: 'attribute_not_exists(#lock) and (attribute_not_exists(#data) or #data = :null)',
        ExpressionAttributeNames: { '#data': 'data', '#lock': 'lock' },
        ExpressionAttributeValues: { ':null': null }
      }).promise().catch(e => { ; })
    }); // ignore lock exists (another process acquired the lock)
  }
}
