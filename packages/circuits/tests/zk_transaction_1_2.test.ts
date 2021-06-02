/**
 * @jest-environment node
 */
/* eslint-disable jest/no-expect-resolves */
/* eslint-disable @typescript-eslint/camelcase */
/* eslint-disable jest/no-hooks */

import { v4 } from 'uuid'
import { Fp } from '~babyjubjub'
import { DB, SQLiteMemoryConnector, TreeSpecies, schema } from '~database/node'
import { genSNARK, SNARKResult } from '~zk-wizard/snark'
import { ZkWizard } from '~zk-wizard'
import {
  checkPhase1Setup,
  compileCircuit,
  getArtifacts,
  phase2Setup,
  prepareArtifactsDirectory,
} from './helper'
import { UtxoTree, TreeConfig, poseidonHasher, genesisRoot } from '~tree'
import { utxos } from '~dataset/testset-utxos'
import { txs } from '~dataset/testset-txs'
import { accounts } from '~dataset/testset-predefined'

const fileName = 'zk_transaction_1_2.test.circom'
const artifacts = getArtifacts(fileName)
const { wasm, finalZkey, vk } = artifacts
const overwrite = false // set it true not to skip circuit compilation & phase 2 setup

describe('zk_transaction_1_2.test.circom', () => {
  let utxoTree: UtxoTree
  const utxoTreeMetadata = {
    id: v4(),
    index: 1,
    species: TreeSpecies.UTXO,
    start: Fp.from(0),
    end: Fp.from(0),
  }
  const depth = 48
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
          { hash: utxos.utxo1_in_1.hash() },
          { hash: utxos.utxo2_1_in_1.hash() },
          { hash: utxos.utxo2_2_in_1.hash() },
          { hash: utxos.utxo3_in_1.hash() },
          { hash: utxos.utxo3_in_2.hash() },
          { hash: utxos.utxo3_in_3.hash() },
          { hash: utxos.utxo4_in_1.hash() },
          { hash: utxos.utxo4_in_2.hash() },
          { hash: utxos.utxo4_in_3.hash() },
        ],
        db,
      )
    })
  })
  afterAll(async () => {
    await mockup.close()
  })
  it('should compile circuits', () => {
    compileCircuit(fileName, { overwrite })
  })
  it('should setup phase 2 for the circuit', () => {
    phase2Setup(fileName, { overwrite })
  }, 60000)
  it('should create SNARK proof', async () => {
    const tx = txs.tx_1
    const signer = accounts.alice
    const merkleProof = {
      0: await utxoTree.merkleProof({
        hash: utxos.utxo1_in_1.hash(),
        index: Fp.from(0),
      }),
    }
    const inputs = ZkWizard.snarkInput({ tx, signer, merkleProof })
    const result: SNARKResult = await genSNARK(inputs, wasm, finalZkey, vk)
    expect(result).toBeDefined()
  }, 20000)
  it('should fail to create a SNARK proof', async () => {
    const tx = txs.tx_1_false
    const signer = accounts.alice
    const merkleProof = {
      0: await utxoTree.merkleProof({
        hash: utxos.utxo1_in_1.hash(),
        index: Fp.from(0),
      }),
    }
    const inputs = ZkWizard.snarkInput({ tx, signer, merkleProof })
    // eslint-disable-next-line jest/require-tothrow-message
    await expect(genSNARK(inputs, wasm, finalZkey, vk)).rejects.toThrow()
  }, 20000)
})
