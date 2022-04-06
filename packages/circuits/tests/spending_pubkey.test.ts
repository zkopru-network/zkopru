/**
 * @jest-environment node
 */
/* eslint-disable jest/no-expect-resolves */
/* eslint-disable @typescript-eslint/camelcase */
/* eslint-disable jest/no-hooks */

import fs from 'fs'
import { genSNARK, SNARKResult } from '~zk-wizard/snark'
import { accounts } from '~dataset/testset-predefined'
import {
  checkPhase1Setup,
  compileCircuit,
  getArtifacts,
  phase2Setup,
  prepareArtifactsDirectory,
} from './helper'

const fileName = 'spending_pubkey.test.circom'
const artifacts = getArtifacts(fileName)
const { wasm, finalZkey, vKeyPath } = artifacts

describe('spending_pubkey.test.circom', () => {
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
    const account = accounts.bob
    const inputs = {
      pubkey_x: account.getEdDSAPubKey().x.toBigInt(),
      pubkey_y: account.getEdDSAPubKey().y.toBigInt(),
      nullifier_seed: account.getNullifierSeed().toBigInt(),
    }
    const result: SNARKResult = await genSNARK(inputs, wasm, finalZkey, vk)
    expect(result.publicSignals[0]).toStrictEqual(
      account.zkAddress.spendingPubKey().toString(),
    )
  })
})
