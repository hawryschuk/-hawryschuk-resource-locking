const { Util } = require('@hawryschuk/common');
const Semaphore = require('./semaphore');
const AtomicFile = require('./atomic.file');
const AtomicDDB = require('./atomic.ddb');
const AtomicS3 = require('./atomic.s3');
describe('Semaphore', () => {
  const test = async semaphore => {
    await semaphore.reset();
    await Promise.all([
      semaphore.use({ user: 'a', block: async () => { await Util.pause(200); } }),
      semaphore.use({ user: 'b', block: async () => { await Util.pause(200); } }),
      semaphore.use({ user: 'c', block: async () => { await Util.pause(300); } }),
      semaphore.use({ user: 'd', block: async () => { await Util.pause(300); } }),
    ]);
    await semaphore.reset();
  };
  it('can allow a limited number of users concurrent access to a resource', async () => {
    await test(new Semaphore({ maxUsers: 2 }));
  });
  it('can specify an AtomicFile as the data the semaphore will use', async () => {
    await test(new Semaphore({ maxUsers: 2, data: new AtomicFile({ filename: 'semaphore.json' }) }));
  });
  it('can specify an AtomicDDB as the data the semaphore will use', async () => {
    await test(new Semaphore({ maxUsers: 2, data: new AtomicDDB({ TableName: 'test', resource: 'test1' }) }));
  });
  it('can specify an AtomicS3 as the data the semaphore will use', async () => { // no need to use atomic-s3 since it already uses a ddb-table for locks
    await test(new Semaphore({ maxUsers: 2, data: new AtomicS3({ Bucket: 'resource-locking', LockTable: 'test' }) }));
  });
});
