const AtomicData = require('./atomic.data');
const {Util }=require('@hawryschuk/common');
/** A semaphore (locks a resource to a maximum number of users, and tracks the queue and users with AtomicData) */
module.exports = class Semaphore {
  static getInstance({ maxUsers, data = new AtomicData() }) {
    const instances = (this.instances = this.instances || {});
    return (instances[data.resource] = instances[data.resource] || new this({ maxUsers, data }));
  }
  constructor({ maxUsers = 1, data = new AtomicData() }) { Object.assign(this, { maxUsers, data }); }
  async reset() {
    if (await this.data.exists) {
      await this.data.update(null);
      await this.data.delete();
    }
  }
  async use({ block, user = Util.UUID }) {
    const self = this;
    await this.data.use({ block: (input = { maxUsers: self.maxUsers, users: [], queue: [] }) => input.queue.push(user) && input });
    await Util.waitUntil(async () => (({ maxUsers, users, queue }) => users.length < maxUsers && queue[0] === user)(await self.data.contents));
    await this.data.use({ block: ({ users, queue }) => { users.push(queue.shift()) } });
    let error; const result = await Promise.resolve().then(block).catch(e => { error = e });
    await this.data.use({ block: ({ users }) => { Util.removeElements(users, user) } });
    if (error) throw Error;
    else return result;
  }
}
