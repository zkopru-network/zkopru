/**
 * @jest-environment node
 */
/* eslint-disable jest/no-expect-resolves */
/* eslint-disable @typescript-eslint/camelcase */
/* eslint-disable jest/no-hooks */

import { v4 } from 'uuid'
import { Fp } from '~babyjubjub'
import { DB, TreeSpecies, schema, SQLiteMemoryConnector } from '~database/node'
import { genSNARK, SNARKResult } from '~zk-wizard/snark'
import {
  checkPhase1Setup,
  compileCircuit,
  getArtifacts,
  phase2Setup,
  prepareArtifactsDirectory,
} from './helper'
import { UtxoTree, TreeConfig, poseidonHasher, genesisRoot } from '~tree'

const fileName = 'inclusion_proof.test.circom'
const artifacts = getArtifacts(fileName)
const { wasm, finalZkey, vk } = artifacts

describe('inclusion_proof.test.circom', () => {
  let utxoTree: UtxoTree
  const utxoTreeMetadata = {
    id: v4(),
    index: 1,
    species: TreeSpecies.UTXO,
    start: Fp.from(0),
    end: Fp.from(0),
  }
  const depth = 3
  const utxoTreeConfig: TreeConfig<Fp> = {
    hasher: poseidonHasher(depth),
    forceUpdate: true,
    fullSync: true,
  }
  const preHashes = poseidonHasher(depth).preHash
  const utxoTreeInitialData = {
    root: genesisRoot(poseidonHasher(depth)),
    index: Fp.zero,
    siblings: preHashes.slice(0, -1),
  }
  let mockup: DB
  beforeAll(async () => {
    checkPhase1Setup()
    prepareArtifactsDirectory()
    mockup = await SQLiteMemoryConnector.create(schema)
    utxoTree = new UtxoTree({
      db: mockup,
      metadata: utxoTreeMetadata,
      data: utxoTreeInitialData,
      config: utxoTreeConfig,
    })
    await utxoTree.init()
    await mockup.transaction(db => {
      utxoTree.append(
        [
          { hash: Fp.from(10) },
          { hash: Fp.from(11) },
          { hash: Fp.from(12) },
          { hash: Fp.from(13) },
          { hash: Fp.from(14) },
        ],
        db,
      )
    })
  })
  afterAll(async () => {
    await mockup.close()
  })
  it('should compile circuits', () => {
    compileCircuit(fileName)
  })
  it('should setup phase 2 for the circuit', () => {
    phase2Setup(fileName)
  })
  it('should create SNARK proof', async () => {
    const merkleProof = await utxoTree.merkleProof({
      hash: Fp.from(12),
      index: Fp.from(2),
    })
    const inputs = {
      root: merkleProof.root.toBigInt(),
      leaf: merkleProof.leaf.toBigInt(),
      path: merkleProof.index.toBigInt(),
      siblings: merkleProof.siblings.map(s => s.toBigInt()),
    }
    const result: SNARKResult = await genSNARK(inputs, wasm, finalZkey, vk)
    expect(result.publicSignals[0]).toStrictEqual('1')
  })
})
