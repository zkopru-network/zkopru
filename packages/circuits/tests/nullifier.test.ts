/**
 * @jest-environment node
 */
/* eslint-disable jest/no-expect-resolves */
/* eslint-disable @typescript-eslint/camelcase */
/* eslint-disable jest/no-hooks */

import fs from 'fs'
import { genSNARK, SNARKResult } from '~zk-wizard/snark'
import { utxos } from '~dataset/testset-utxos'
import { accounts } from '~dataset/testset-predefined'
import { Fp } from '~babyjubjub'
import {
  checkPhase1Setup,
  compileCircuit,
  getArtifacts,
  phase2Setup,
  prepareArtifactsDirectory,
} from './helper'

const fileName = 'nullifier.test.circom'
const artifacts = getArtifacts(fileName)
const { wasm, finalZkey, vKeyPath } = artifacts

describe('nullifier.test.circom', () => {
  let vk
  beforeAll(() => {
    checkPhase1Setup()
    prepareArtifactsDirectory()
  })
  it('should compile circuits', () => {
    compileCircuit(fileName)
  })
  it('should setup phase 2 for the circuit', () => {
    phase2Setup(fileName)
    vk = JSON.parse(fs.readFileSync(vKeyPath).toString())
  })
  it('should create SNARK proof', async () => {
    const utxo = utxos.utxo1_out_1
    const account = accounts.bob
    const inputs = {
      nullifier_seed: account.getNullifierSeed().toBigInt(),
      leaf_index: Fp.from(32).toBigInt(),
    }
    const result: SNARKResult = await genSNARK(inputs, wasm, finalZkey, vk)
    expect(result.publicSignals[0]).toStrictEqual(
      utxo.nullifier(account.getNullifierSeed(), Fp.from(32)).toString(),
    )
  })
})
