const { expect } = require('chai');
const test = module.exports = (type, data) => {
  if (!/AtomicDDB/.test(type)) return;
  const _describe = /^$/.test(type) ? describe.only : describe;
  _describe(type, () => {
    beforeEach(() => data.use({ block: () => [1, 2, 3] }));
    it.only('can update the an atomic data', async () => {
      await data.use({
        block: Body => {
          expect(Body).to.deep.equal([1, 2, 3]);                /** ASSERT      : The data was written successfully */
          Body.push(4);                                         /** ACT         : Update the data */
        }
      });
      expect(await data.contents).to.deep.equal([1, 2, 3, 4]);  /** ASSERT      : The contents reflect the update to the Body */
    });
    it('can delete the atomic file', async () => {
      await data.use({ block: () => null });
      if (await data.exists) throw new Error('file shouldnt exist');
    });
    it('can unallocate the atomic data', async () => {
      await data.delete();
      if (await data.exists) throw new Error('data shouldnt exist');
    });
  });
}
