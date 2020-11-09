/**
 * @jest-environment node
 */
/* eslint-disable jest/no-expect-resolves */
/* eslint-disable @typescript-eslint/camelcase */
/* eslint-disable jest/no-hooks */

import { genSNARK, SNARKResult } from '~zk-wizard/snark'
import {
  checkPhase1Setup,
  compileCircuit,
  getArtifactPaths,
  phase2Setup,
  prepareArtifactsDirectory,
} from './helper'
import { accounts } from '~dataset/testset-predefined'

const fileName = 'spending_pubkey.test.circom'
const artifacts = getArtifactPaths(fileName)
const { wasm, finalZkey, vk } = artifacts

describe('spending_pubkey.test.circom', () => {
  beforeAll(() => {
    checkPhase1Setup()
    prepareArtifactsDirectory()
  })
  it('should compile circuits', () => {
    compileCircuit(fileName)
  })
  it('should setup phase 2 for the circuit', () => {
    phase2Setup(fileName)
  })
  it('should create SNARK proof', async () => {
    const account = accounts.bob
    const inputs = {
      pubkey_x: account.getEdDSAPoint().x.toBigInt(),
      pubkey_y: account.getEdDSAPoint().y.toBigInt(),
      nullifier_seed: account.getNullifierSeed().toBigInt(),
    }
    const result: SNARKResult = await genSNARK(inputs, wasm, finalZkey, vk)
    expect(result.publicSignals[0]).toStrictEqual(
      account.zkAddress.spendingPubKey().toString(),
    )
  })
})
