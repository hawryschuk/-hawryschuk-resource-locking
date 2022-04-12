
const Singleton = require('./singleton');
const { Util } = require('@hawryschuk/common');
Util.defaults.pause = 25;

/** A mutex lock stored in [[inner-]process] memory */
module.exports = class Mutex extends Singleton { // implements Singleton
  static key({ resource }) { return resource }
  constructor({ resource = Util.UUID, pause = 25, retries = Infinity, timeout = Infinity }) { super({ resource, pause, retries, timeout }); }
  get locked() { return this._locked; }
  set locked(user) { this._locked = user; }
  async acquire({ user = Util.UUID } = {}) {
    if (this.locked) throw new Error(`${user} cannot acquire the lock owned by ${this.locked}`);
    this.locked = user; return user;
  }
  async release({ user }) {
    if (this.locked !== user) throw new Error(` ${user} cannot release the lock owned by ${this.locked}`);
    this.locked = null;
  }
  async use({ block, user = Util.UUID, retries = this.retries, pause = this.pause, timeout = this.timeout }) {
    const self = this;
    await Util.retry({ block: () => self.acquire({ user }), timeout, pause, retries }).catch(() => { throw new Error('LockAcquisitionError'); });
    let error; const result = await Promise.resolve(1).then(block).catch(e => { error = e });
    await this.release({ user });
    if (error) throw error;
    else return result;
  }
}
