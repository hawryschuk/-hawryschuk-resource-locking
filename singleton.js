/** Thre singleton pattern: @example: Singleton.getInstance('abc) */
module.exports = class Singleton {
  static getInstance(args) {
    const instances = (this.instances = this.instances || {});
    const resource = this.key(args);
    return (instances[resource] = instances[resource] || new this(args));
  }
  static key(args) { return JSON.stringify(args, Object.keys(args)) }
  constructor(args) { Object.assign(this, args) }
}
