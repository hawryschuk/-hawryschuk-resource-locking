const DDBMutex = require('./ddb.mutex');
const AtomicData = require('./atomic.data');
const s3helper = require('./s3.helper');
const { Util } = require('@hawryschuk/common');
/** AtomicData stored in an AWS-S3-Object */
module.exports = class AtomicS3 extends AtomicData {
  static key({ Bucket, Key, LockTable }) { return `s3://${Bucket}/${Key} in ddb://${LockTable}`; }
  constructor({ Bucket, Key = Util.UUID, mutex, LockTable, retries }) {
    super({
      mutex: mutex || DDBMutex.getInstance({
        resource: AtomicS3.key({ Bucket, Key }),
        TableName: LockTable,
        retries
      }),
      resource: AtomicS3.key({ Bucket, Key, LockTable })
    });
    Object.assign(this, { Bucket, Key, LockTable });
  }
  get exists() { return s3helper.exists(this) }
  async delete() { await s3helper.remove(this) }
  get contents() { return this.exists.then(e => e ? s3helper.get(this) : undefined); }
  async update(Body) {
    if ([undefined, null].includes(Body)) {
      await this.delete();
    } else {
      await this.exists
        ? await s3helper.update({ ...this, Body })
        : await s3helper.put({ ...this, Body });
    }
  }
}
