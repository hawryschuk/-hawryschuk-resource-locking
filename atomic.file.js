const FileMutex = require('./file.mutex')
const AtomicData = require('./atomic.data');
const { readFileSync, writeFileSync, existsSync, unlinkSync } = require('fs');
/** AtomicData stored in a file */
module.exports = class AtomicFile extends AtomicData {
  static key({ filename }) { return `file://${filename}` }
  constructor({ filename, json }) {
    super({ resource: filename, mutex: FileMutex.getInstance({ resource: filename }) });
    Object.assign(this, { filename, json: json === undefined ? /\.json$/i.test(filename) : json });
  }
  get exists() { return existsSync(this.filename) }
  delete() { if (this.exists) unlinkSync(this.filename); }
  get contents() {
    const contents = this.exists ? readFileSync(this.filename, 'utf8') : undefined;
    return contents && this.json ? JSON.parse(contents) : contents;
  }
  update(contents) {
    if ([undefined, null].includes(contents)) this.delete();
    else writeFileSync(this.filename, this.json ? JSON.stringify(contents, null, 2) : contents, 'utf8');
  }
}
