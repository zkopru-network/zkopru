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
import { utxos } from '~dataset/testset-utxos'

const fileName = 'asset_hash.test.circom'
const artifacts = getArtifactPaths(fileName)
const { wasm, finalZkey, vk } = artifacts

describe('asset_hash.test.circom', () => {
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
    const utxo = utxos.utxo1_out_1
    const inputs = {
      eth: utxo.eth().toBigInt(),
      token_addr: utxo.tokenAddr().toBigInt(),
      erc20: utxo.erc20Amount().toBigInt(),
      erc721: utxo.nft().toBigInt(),
    }
    const result: SNARKResult = await genSNARK(inputs, wasm, finalZkey, vk)
    expect(result.publicSignals[0]).toStrictEqual(utxo.assetHash().toString())
  })
})
