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

const fileName = 'multiplier.test.circom'
const artifacts = getArtifactPaths(fileName)
const { wasm, finalZkey, vk } = artifacts

describe('multiplier.test.circom', () => {
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
    const result: SNARKResult = await genSNARK(
      {
        a: 10,
        b: 21,
      },
      wasm,
      finalZkey,
      vk,
    )
    expect(result).toBeDefined()
  })
  it('should throw error with invalid inputs', async () => {
    await expect(
      genSNARK(
        {
          a: 10,
          c: 21,
        },
        wasm,
        finalZkey,
        vk,
      ),
    ).rejects.toThrow(Error)
  })
})
