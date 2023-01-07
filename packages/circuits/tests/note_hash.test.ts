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
import {
  checkPhase1Setup,
  compileCircuit,
  getArtifacts,
  phase2Setup,
  prepareArtifactsDirectory,
} from './helper'

const fileName = 'note_hash.test.circom'
const artifacts = getArtifacts(fileName)
const { wasm, finalZkey, vKeyPath } = artifacts

describe('note_hash.test.circom', () => {
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
      spending_pubkey: account.zkAddress.spendingPubKey().toBigInt(),
      salt: utxo.salt.toBigInt(),
      asset_hash: utxo.assetHash().toBigInt(),
    }
    const result: SNARKResult = await genSNARK(inputs, wasm, finalZkey, vk)
    expect(result.publicSignals[0]).toStrictEqual(utxo.hash().toString())
  })
})
