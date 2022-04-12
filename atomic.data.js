const Mutex = require('./mutex');
const { Util } = require('@hawryschuk/common');
const Singleton = require('./singleton');
/** Atomic data ( data is used/mutated under a mutex ) */
module.exports = class AtomicData extends Singleton {
  static key({ resource }) { return resource }
  constructor({ resource = Util.UUID, mutex, retries } = {}) { super({ resource, mutex: mutex || Mutex.getInstance({ resource, retries }) }); }
  get locked() { return this.mutex.locked }
  get exists() { return '_contents' in this; }
  delete() { delete this._contents; }
  get contents() { return this.exists ? this._contents : undefined; }
  async update(contents) {
    if ([undefined, null].includes(contents)) await this.delete();
    else this._contents = contents;
  }
  /** Use the atomic data : Acquire Lock, Execute Block, Release Lock -- Allow retries# for mutex-acquisition */
  async use({ block, user = Util.UUID, retries = this.retries }) {
    const self = this;
    return await this.mutex.use({
      user,
      retries,
      block: async () => {
        const input = await self.contents;
        let output = await Promise.resolve(1).then(() => block(input));
        if (output === undefined && input !== undefined) output = input;      // let output be the input reference
        if (output !== undefined) await self.update(output);                  // update the data
        return output;
      }
    });
  }
}
