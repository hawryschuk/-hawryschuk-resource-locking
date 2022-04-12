const { Util } = require('@hawryschuk/common');
const testMutex = module.exports = (title, constructMutex) => {
  const _describe = /^$/.test(title) ? describe.only : describe;
  _describe(title, () => {
    let mutex; beforeEach(() => (mutex = constructMutex()));
    it('can acquire and release a resource [lock]', async () => {
      const user = await mutex.acquire();
      await Util.pause(500);
      await mutex.release({ user });
    });
    it('can use a resource [lock] (acquire-block-release)', () => Promise.all([
      mutex.use({ block: () => Util.pause(100) }),
      mutex.use({ block: () => Util.pause(50) }),
      mutex.use({ block: () => Util.pause(50) }),
    ]));
    it('will fail when the lock is released when not in use', async () => {
      let error; await Promise.resolve().then(async () => mutex.release({ user: 'a' })).catch(e => { error = e });
      if (!error) throw new Error('error was expected');
    });
  });
};