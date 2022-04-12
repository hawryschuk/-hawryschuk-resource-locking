const DDBMutex = require('./ddb.mutex');
const AtomicData = require('./atomic.data');
const awshelper = require('./aws.helper');
const { Util } = require('@hawryschuk/common');
/** AtomicData stored in an AWS-DDB-Record */
module.exports = class AtomicDDB extends AtomicData {
  static key({ resource, TableName }) { return `ddb://${TableName}/${resource}` }

  // TODO: constructor({ mutex, TableName, Key, LockTable }) { }

  constructor({ resource, TableName }) {
    super({
      resource,
      mutex: DDBMutex.getInstance({ resource, TableName })
    });
  }
  get TableName() { return this.mutex.TableName }
  get exists() { return this.mutex.exists; }
  async delete() { await this.use({ block: () => null }); }
  get contents() { return this.mutex.record.then(record => record.data) }
  async update(contents) {
    const { TableName, resource: resourceName } = this;
    await Util.timeIt({
      logger: ({ ms }) => { }, // Util.log(`${ms}ms to update ddb data`)
      block: () => awshelper.DocumentClient.update({
        TableName,
        Key: { resourceName },
        UpdateExpression: 'set #data = :data',
        ExpressionAttributeNames: { '#data': 'data' },
        ExpressionAttributeValues: { ':data': contents },
        ReturnValues: 'ALL_OLD'
      }).promise()
    });
  }
}
