import * as snarkjs from 'snarkjs'
import * as ffjs from 'ffjavascript'
import fs from 'fs'
import assert from 'assert'
import { ProverResult, SNARKResult } from './snark'

process.on(
  'message',
  async (message: {
    inputs: any
    wasmPath: string
    zKeyPath: string
    vkPath: string
  }) => {
    assert(
      process.send,
      'It looks a master process. This should be a forked process',
    )
    let result: ProverResult
    let snark: SNARKResult | undefined
    let err: string | undefined
    try {
      const { inputs, wasmPath, zKeyPath, vkPath } = message
      const { proof, publicSignals } = await snarkjs.groth16.fullProve(
        ffjs.utils.unstringifyBigInts(inputs),
        wasmPath,
        zKeyPath,
      )
      const vKey = JSON.parse(fs.readFileSync(vkPath).toString())
      const validity = await snarkjs.groth16.verify(vKey, publicSignals, proof)
      if (validity) {
        snark = { proof, publicSignals }
      } else {
        snark = undefined
        err = `Failed to generate SNARK proof`
      }
    } catch (e) {
      // e is undefined. #TODO update this if snarkjs is updated.
      err = `SNARK runtime error ${e}`
    } finally {
      result = { snark, err }
      process.send(result)
      process.exit(0)
    }
  },
)
