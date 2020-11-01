/**
 * @jest-environment node
 */
/* eslint-disable jest/no-expect-resolves */
/* eslint-disable @typescript-eslint/camelcase */
/* eslint-disable jest/no-hooks */

import { v4 } from 'uuid'
import { Field } from '~babyjubjub'
import { DB, TreeSpecies, MockupDB } from '~prisma'
import { genSNARK, SNARKResult } from '~zk-wizard/snark'
import {
  checkPhase1Setup,
  compileCircuit,
  getArtifactPaths,
  phase2Setup,
  prepareArtifactsDirectory,
} from './helper'
import { UtxoTree, TreeConfig, poseidonHasher, genesisRoot } from '~tree'

const fileName = 'inclusion_proof.test.circom'
const artifacts = getArtifactPaths(fileName)
const { wasm, finalZkey, vk } = artifacts

describe('inclusion_proof.test.circom', () => {
  let utxoTree: UtxoTree
  const utxoTreeMetadata = {
    id: v4(),
    index: 1,
    species: TreeSpecies.UTXO,
    start: Field.from(0),
    end: Field.from(0),
  }
  const depth = 3
  const utxoTreeConfig: TreeConfig<Field> = {
    hasher: poseidonHasher(depth),
    forceUpdate: true,
    fullSync: true,
  }
  const preHashes = poseidonHasher(depth).preHash
  const utxoTreeInitialData = {
    root: genesisRoot(poseidonHasher(depth)),
    index: Field.zero,
    siblings: preHashes.slice(0, -1),
  }
  let mockup: MockupDB
  beforeAll(async () => {
    checkPhase1Setup()
    prepareArtifactsDirectory()
    mockup = await DB.mockup()
    utxoTree = new UtxoTree({
      db: mockup.db,
      metadata: utxoTreeMetadata,
      data: utxoTreeInitialData,
      config: utxoTreeConfig,
    })
    await utxoTree.init()
    await utxoTree.append(
      ...[
        { hash: Field.from(10) },
        { hash: Field.from(11) },
        { hash: Field.from(12) },
        { hash: Field.from(13) },
        { hash: Field.from(14) },
      ],
    )
  })
  afterAll(async () => {
    await mockup.terminate()
  })
  it('should compile circuits', () => {
    compileCircuit(fileName)
  })
  it('should setup phase 2 for the circuit', () => {
    phase2Setup(fileName)
  })
  it('should create SNARK proof', async () => {
    const merkleProof = await utxoTree.merkleProof({
      hash: Field.from(12),
      index: Field.from(2),
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
