const { promisify } = require('util');
const { execFile, execFileSync } = require('child_process');
/** Common utility methods : pure functions */
module.exports = class Util {
  static get defaults() { return (this._defaults = this._defaults || { timeout: 300000, pause: 1000 }); }
  static log(...messages) { console.log(new Date(), ...messages); }
  static unique(arr) { return Array.from(new Set(arr)); }
  static btoa(obj) { return Buffer.from(obj).toString('base64'); }
  static atob(b64Encoded) { return Buffer.from(b64Encoded, 'base64').toString(); }
  static jwtDecode(jwt) { return JSON.parse(Util.atob(jwt.split('.')[1])); }
  static pretty(obj) { return JSON.stringify(obj, null, 2); }
  static prettyPrint(obj) { return console.log(Util.pretty(obj)); }
  static pluck(arr, ...keys) { return arr.map(i => keys.length > 1 ? keys.reduce((plucked, key) => ({ ...plucked, [key]: i[key] }), {}) : i[keys[0]]); }
  static pick(obj, ...keys) { return keys.reduce((picked, key) => ({ ...picked, [key]: obj[key] }), {}) }
  static UUID { return ('' + 1e7 + -1e3 + -4e3 + -8e3 + -1e11).replace(/1|0/g, () => (0 | Math.random() * 16).toString(16)); }
  static falsy(x) { return !x; }
  static truthy(x) { return !!x; }
  static matches(obj, props) { return Object.entries(props).every(([key, val]) => val instanceof Function ? val(obj[key]) : obj[key] === val); }
  static findWhere(arr, props) { return arr.find(obj => Util.matches(obj, props)) }
  static where(arr, props) { return arr.filter(obj => Object.entries(props).every(([key, val]) => obj[key] === val)) }
  static Params(params) { return Object.keys(params).sort().map(key => `${key}=${encodeURIComponent(params[key])}`).join('&') }
  static safely(block, fallback) { try { return block(); } catch (e) { return fallback; } }
  static pause(ms) { return new Promise((resolve, reject) => setTimeout(resolve, ms)) }
  static addTime({ date = new Date(), days = 0 }) { return Math.floor(date.getTime() / 1000) + (days * 24 * 60 * 60) }
  static exec(cmd, ...args) { return promisify(execFile)(cmd, args) }
  static execSync(cmd, ...args) { return execFileSync(cmd, args).toString('utf8') }
  static removeElements(arr, ...elements) {
    const removed = [];
    for (let element of elements) {
      const index = arr.indexOf(element);
      if (index >= 0) removed.push(...arr.splice(index, 1));
    }
    return removed;
  }
  static replaceElements(arr, replacements) {
    for (let { find, replace } of replacements) {
      const index = arr.indexOf(find);
      if (index >= 0) arr[index] = replace;
    }
    return arr;
  }
  static async timeIt({ block = () => { throw Error('no block defined') }, logger = ({ ms, result }) => console.log(`${ms} ms elapsed`) }) {
    const startTime = new Date();
    const result = await block();
    const ms = new Date() - startTime;
    logger && logger({ ms, result });
    return { result, ms };
  }
  static async retry({ block, timeout = this.defaults.timeout, retries = Infinity, pause = this.defaults.pause, onError }) {
    const startTime = new Date(); let failures = 0;
    while (true) {
      let error; const result = await Promise.resolve(1).then(block).catch(e => { error = e });
      if (!error) return result;        // SUCCESS: return result
      else {                            // FAILURE: track(#failures, timedout, maximumRetries, logErrors), stop || pause-retry
        failures++;
        const timeElapsed = new Date() - startTime;
        const timedout = typeof timeout === 'number' && timeElapsed >= timeout;
        const maximumRetries = typeof retries === 'number' && failures > retries;
        Object.assign(error, { failures, timeElapsed, timedout, maximumRetries });
        if (onError) onError(error)                   // onError handling (ie: logging)
        if (timedout || maximumRetries) {
          throw error;  // Stop     Retrying : Timedout || Max-Retries
        }
        await Util.pause(pause);                      // Continue Retrying : After pausing
      }
    }
  }
  static async waitUntil(untilTruthy, { timeout = this.defaults.timeout, pause = this.defaults.pause, maxAttempts, dowhile, throwError } = {}) {
    let reattempts = 0; const startTime = new Date();   // TODO: make throwError default to true
    while (1) {
      let result = await untilTruthy();
      if (!result || (dowhile && await dowhile(result))) {
        const timedout = !!timeout && new Date() - startTime >= timeout;
        const maxattempts = maxAttempts && ++reattempts >= maxAttempts;
        if (timedout || maxattempts) {    // final attempt reached
          if (throwError) throw Object.assign(new Error('waitUntil failure'), { result, timedout, maxattempts, reattempts });
          else console.log('[waitUntil] timeout ', { reattempts, timedout, maxattempts });
          return result;
        } else {                          // re-attempt after a pause
          await Util.pause(pause);
        }
      } else {                            // block has result
        return result;
      }
    }
  }
};
