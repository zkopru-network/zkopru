import { join } from 'path'
import { fork } from 'child_process'
import * as ffjs from 'ffjavascript'
import prove from './snark-prover'

export type SNARKResult = {
  proof: any
  publicSignals: any
}

export type ProverResult = {
  snark?: SNARKResult
  err?: string
}

export interface VerifyingKey {
  protocol: string
  nPublic: number
  curve: string
  vk_alpha_1: BigInt[]
  vk_beta_2: BigInt[][]
  vk_gamma_2: BigInt[][]
  vk_delta_2: BigInt[][]
  vk_alphabeta_12: BigInt
  IC: BigInt[][]
}

export async function genSNARK(
  inputs: any,
  wasmPath: string,
  zKeyPath: string,
  vKey: Record<string, any>,
): Promise<SNARKResult> {
  if (typeof window !== 'undefined') {
    // we're in a browser, use a webworker instead of a forked process
    // TODO: actually use a webworker
    return prove({
      inputs,
      wasmPath,
      zKeyPath,
      vKey,
    })
  }
  return new Promise<SNARKResult>((res, rej) => {
    const process = fork(join(__dirname, 'snark-prover-node.js'), [
      '-r',
      'ts-node/register',
    ])
    process.on('message', message => {
      const result = message as ProverResult
      if (result.snark) res(result.snark)
      else rej(new Error(result.err))
      process.kill()
    })
    process.send({
      inputs: ffjs.utils.stringifyBigInts(inputs),
      wasmPath,
      zKeyPath,
      vKey,
    })
  })
}
