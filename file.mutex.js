const {Util }=require('@hawryschuk/common');
const { writeFileSync, existsSync, unlinkSync, readFileSync } = require('fs');
const Mutex = require('./mutex');
/** A mutex lock stored in the [local] file system */
module.exports = class FileMutex extends Mutex {
  get lockfile() { return `.lock.${Util.btoa(this.resource)}`; }
  get locked() { return existsSync(this.lockfile) && readFileSync(this.lockfile, 'utf8') }
  set locked(user) { user ? writeFileSync(this.lockfile, user, { flag: 'wx' }) : unlinkSync(this.lockfile); }
}
