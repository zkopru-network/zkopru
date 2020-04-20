/* eslint-disable jest/no-disabled-tests */
/* eslint-disable jest/no-hooks */
import { Field } from '@zkopru/babyjubjub'
import { nSQL } from '@nano-sql/core'
import { schema } from '@zkopru/database'
import { NullifierTree, keccakHasher, genesisRoot } from '~tree'

describe('nullifier tree unit test', () => {
  let nullifierTree: NullifierTree
  const depth = 254
  const hasher = keccakHasher(depth)
  const zkopruId = 'tempzkopru'
  beforeAll(async () => {
    const dbName = 'unittest'
    await nSQL().createDatabase({
      id: dbName,
      mode: 'TEMP',
      tables: [schema.nullifiers, schema.nullifierTreeNode],
      version: 3,
    })
    const db = nSQL()
    db.useDatabase(dbName)
    nullifierTree = new NullifierTree({
      db,
      hasher,
      zkopruId,
      depth,
    })
  })
  describe('root()', () => {
    it('should return the last item of the prehashed zero for its initial root', async () => {
      expect(
        (await nullifierTree.root()).eq(genesisRoot(hasher)),
      ).toStrictEqual(true)
    })
  })
  describe('getInclusionProof()', () => {
    it('should not be able to generate an inclusion proof for a non existing item', async () => {
      await expect(
        nullifierTree.getInclusionProof(Field.from(12345)),
      ).rejects.toThrow('Generated invalid proof')
    })
    it('should be able to generate an inclusion proof for an existing item', async () => {
      await nullifierTree.nullify('TEMPBLOCK', Field.from(123456))
      const proof = await nullifierTree.getInclusionProof(Field.from(123456))
      expect(proof).toBeDefined()
    })
  })
  describe('getNonInclusionProof()', () => {
    it('should not be able to generate a non-inclusion proof for an existing item', async () => {
      await nullifierTree.nullify('TEMPBLOCK', Field.from(1234567))
      await expect(
        nullifierTree.getNonInclusionProof(Field.from(1234567)),
      ).rejects.toThrow('Generated invalid proof')
    })
    it('should be able to generate a non-inclusion proof for an non-existing item', async () => {
      const proof = await nullifierTree.getNonInclusionProof(
        Field.from(12345678),
      )
      expect(proof).toBeDefined()
    })
  })
  describe('recover()', () => {
    it('should not update when you call recover() against an empty leaf', async () => {
      const prevRoot = await nullifierTree.root()
      await nullifierTree.recover('TEMPBLOCK', Field.from(123))
      expect((await nullifierTree.root()).eq(prevRoot)).toStrictEqual(true)
    })
  })
  describe('nullify()', () => {
    it('should update the root when you nullify() against an empty leaf', async () => {
      const prevRoot = await nullifierTree.root()
      await nullifierTree.nullify('TEMPBLOCK', Field.from(123))
      expect((await nullifierTree.root()).eq(prevRoot)).toStrictEqual(false)
    })
    it('should not update the root when you nullify() against an already nullified leaf', async () => {
      const prevRoot = await nullifierTree.root()
      await nullifierTree.nullify('TEMPBLOCK', Field.from(123))
      expect((await nullifierTree.root()).eq(prevRoot)).toStrictEqual(true)
    })
    it('should be recovered by recover()', async () => {
      const prevRoot = await nullifierTree.root()
      await nullifierTree.nullify('TEMPBLOCK', Field.from(1234))
      await nullifierTree.recover('TEMPBLOCK', Field.from(1234))
      expect((await nullifierTree.root()).eq(prevRoot)).toStrictEqual(true)
    })
  })
  describe('dryRunNullify', () => {
    it('should not update its root', async () => {
      const prevRoot = await nullifierTree.root()
      const nullifiers: Field[] = [Field.from(1), Field.from(2)]
      await nullifierTree.dryRunNullify(...nullifiers)
      expect((await nullifierTree.root()).eq(prevRoot)).toBe(true)
    })
  })
  describe('append', () => {
    it('should update its root and its value should equal to the dry run', async () => {
      const prevRoot = await nullifierTree.root()
      const nullifiers: Field[] = [Field.from(1), Field.from(2)]
      const dryResult = await nullifierTree.dryRunNullify(...nullifiers)
      const result = await nullifierTree.nullify('mark', ...nullifiers)
      expect(result.eq(prevRoot)).toBe(false)
      expect(result.eq(dryResult)).toBe(true)
    })
    it.todo('should have same result with its solidity version')
  })
})
