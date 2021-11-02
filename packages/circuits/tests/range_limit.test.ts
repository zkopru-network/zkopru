/**
 * @jest-environment node
 */
/* eslint-disable jest/require-tothrow-message */
/* eslint-disable jest/no-expect-resolves */
/* eslint-disable @typescript-eslint/camelcase */
/* eslint-disable jest/no-hooks */

import fs from 'fs'
import { genSNARK, SNARKResult } from '~zk-wizard/snark'
import {
  checkPhase1Setup,
  compileCircuit,
  getArtifacts,
  phase2Setup,
  prepareArtifactsDirectory,
} from './helper'

const fileName = 'range_limit.test.circom'
const artifacts = getArtifacts(fileName)
const { wasm, finalZkey, vKeyPath } = artifacts

describe('multiplier.test.circom', () => {
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
    const result: SNARKResult = await genSNARK({ in: 7 }, wasm, finalZkey, vk)
    expect(result).toBeDefined()
  })
  it('should throw error with invalid inputs', async () => {
    await expect(genSNARK({ in: 8 }, wasm, finalZkey, vk)).rejects.toThrow()
  })
})
