/* eslint-disable jest/require-tothrow-message */
/* eslint-disable jest/no-disabled-tests */
/* eslint-disable jest/no-hooks */
import { DB, SQLiteConnector, schema } from '~database/node'
import { TreeCache, NullifierTree, keccakHasher, genesisRoot } from '../../src'
import { BigNumber } from 'ethers'

describe('nullifier tree unit test', () => {
  let nullifierTree: NullifierTree
  const depth = 254
  const hasher = keccakHasher(depth)
  let mockup: DB
  beforeAll(async () => {
    mockup = await SQLiteConnector.create(schema, ':memory:')
    nullifierTree = new NullifierTree({
      db: mockup,
      hasher,
      depth,
      treeCache: new TreeCache(),
    })
  })
  afterAll(async () => {
    await mockup.close()
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
        nullifierTree.getInclusionProof(BigNumber.from(12345)),
      ).rejects.toThrow('Generated invalid inclusion proof')
    }, 60000)
    it('should be able to generate an inclusion proof for an existing item', async () => {
      await mockup.transaction(async db =>
        nullifierTree.nullify([BigNumber.from(123456)], db),
      )
      const proof = await nullifierTree.getInclusionProof(BigNumber.from(123456))
      expect(proof).toBeDefined()
    }, 60000)
  })
  describe('getNonInclusionProof()', () => {
    it('should not be able to generate a non-inclusion proof for an existing item', async () => {
      await mockup.transaction(async db =>
        nullifierTree.nullify([BigNumber.from(1234567)], db),
      )
      await expect(
        nullifierTree.getNonInclusionProof(BigNumber.from(1234567)),
      ).rejects.toThrow('Generated invalid non inclusion proof')
    }, 60000)
    it('should be able to generate a non-inclusion proof for an non-existing item', async () => {
      const proof = await nullifierTree.getNonInclusionProof(BigNumber.from(12345678))
      expect(proof).toBeDefined()
    }, 30000)
  })
  describe('recover()', () => {
    it('should not update when you call recover() against an empty leaf', async () => {
      await expect(
        mockup.transaction(async db => nullifierTree.recover([BigNumber.from(123)], db)),
      ).rejects.toThrow()
    }, 60000)
  })
  describe('nullify()', () => {
    it('should update the root when you nullify() against an empty leaf', async () => {
      const prevRoot = await nullifierTree.root()
      await mockup.transaction(async db =>
        nullifierTree.nullify([BigNumber.from(123)], db),
      )
      expect((await nullifierTree.root()).eq(prevRoot)).toStrictEqual(false)
    }, 30000)
    it('should not update the root when you nullify() against an already nullified leaf', async () => {
      await expect(
        mockup.transaction(async db => nullifierTree.nullify([BigNumber.from(123)], db)),
      ).rejects.toThrow()
    }, 30000)
    it('should be recovered by recover()', async () => {
      const prevRoot = await nullifierTree.root()
      await mockup.transaction(async db => {
        await nullifierTree.nullify([BigNumber.from(1234)], db)
        await nullifierTree.recover([BigNumber.from(1234)], db)
      })
      expect((await nullifierTree.root()).eq(prevRoot)).toStrictEqual(true)
    }, 30000)
  })
  describe('dryRunNullify', () => {
    it('should not update its root', async () => {
      const prevRoot = await nullifierTree.root()
      const nullifiers: BigNumber[] = [BigNumber.from(11111), BigNumber.from(11112)]
      await nullifierTree.dryRunNullify(...nullifiers)
      expect((await nullifierTree.root()).eq(prevRoot)).toBe(true)
    }, 60000)
    it('should emit error when it uses an already spent nullifier', async () => {
      const nullifiers: BigNumber[] = [BigNumber.from(111111111), BigNumber.from(111111111)]
      await expect(nullifierTree.dryRunNullify(...nullifiers)).rejects.toThrow()
    }, 60000)
  })
  describe('append', () => {
    it('should update its root and its value should equal to the dry run', async () => {
      const prevRoot = await nullifierTree.root()
      const nullifiers: BigNumber[] = [BigNumber.from(33333333), BigNumber.from(444444444)]
      const dryResult = await nullifierTree.dryRunNullify(...nullifiers)
      let result!: BigNumber
      await mockup.transaction(async db => {
        result = await nullifierTree.nullify(nullifiers, db)
      })
      expect(result.eq(prevRoot)).toBe(false)
      expect(result.eq(dryResult)).toBe(true)
    }, 120000)
    it.todo('should have same result with its solidity version')
  })
})
