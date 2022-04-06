/**
 * @jest-environment node
 */
/* eslint-disable jest/no-expect-resolves */
/* eslint-disable @typescript-eslint/camelcase */
/* eslint-disable jest/no-hooks */

import fs from 'fs'
import * as snarkjs from 'snarkjs'
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

const fileName = 'ownership_proof.test.circom'
const artifacts = getArtifacts(fileName)
const { wasm, finalZkey, vKeyPath } = artifacts

describe('ownership_proof.test.circom', () => {
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
    const eddsa = account.signEdDSA(utxo.hash())
    const inputs = {
      note: utxo.hash().toBigInt(),
      Ax: account.getEdDSAPubKey().x.toBigInt(),
      Ay: account.getEdDSAPubKey().y.toBigInt(),
      R8x: eddsa.R8.x.toBigInt(),
      R8y: eddsa.R8.y.toBigInt(),
      S: eddsa.S.toBigInt(),
    }

    const result: SNARKResult = await genSNARK(inputs, wasm, finalZkey, vk)
    const validity = await snarkjs.groth16.verify(
      vk,
      result.publicSignals,
      result.proof,
    )
    expect(result).toBeDefined()
    expect(validity).toStrictEqual(true)
  })
  it('should fail to create SNARK proof with invalid account', async () => {
    const utxo = utxos.utxo1_out_1
    const { alice } = accounts
    const { bob } = accounts
    const eddsa = alice.signEdDSA(utxo.hash())
    const inputs = {
      note: utxo.hash().toBigInt(),
      Ax: bob.getEdDSAPubKey().x.toBigInt(),
      Ay: bob.getEdDSAPubKey().y.toBigInt(),
      R8x: eddsa.R8.x.toBigInt(),
      R8y: eddsa.R8.y.toBigInt(),
      S: eddsa.S.toBigInt(),
    }
    await expect(genSNARK(inputs, wasm, finalZkey, vk)).rejects.toThrow(
      'Failed to generate SNARK proof',
    )
  })
})
