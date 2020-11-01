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

const fileName = 'matrix.test.circom'
const artifacts = getArtifactPaths(fileName)
const { wasm, finalZkey, vk } = artifacts
const validData = {
  a: [
    [0, -1, 3],
    [2, 1, 4],
  ],
  b: [
    [-2, 11, 12, 13],
    [-4, -3, -1, 14],
    [0, 2, 1, 5],
  ],
  ab: [
    [4, 9, 4, 1],
    [-8, 27, 27, 60],
  ],
}
const invalidData = {
  a: [
    [0, -1, 3],
    [2, 1, 4],
  ],
  b: [
    [-2, 11, 12, 13],
    [-4, -3, -1, 14],
    [0, 2, 1, 5],
  ],
  ab: [
    [4, 9, 4, 1],
    [-8, 27, 27, 61],
  ],
}

describe('multiplier.test.circom', () => {
  beforeAll(() => {
    checkPhase1Setup()
    prepareArtifactsDirectory()
  })
  it('should compile circuits', () => {
    compileCircuit(fileName, { overwrite: true })
  })
  it('should setup phase 2 for the circuit', () => {
    phase2Setup(fileName, { overwrite: true })
  })
  it('should create SNARK proof', async () => {
    const result: SNARKResult = await genSNARK(validData, wasm, finalZkey, vk)
    expect(result).toBeDefined()
  }, 30000)
  it('should throw error with invalid inputs', async () => {
    await expect(genSNARK(invalidData, wasm, finalZkey, vk)).rejects.toThrow(
      Error,
    )
  })
})
