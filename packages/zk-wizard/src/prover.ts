import * as ffjs from 'ffjavascript'
import * as circomruntime from 'circom_runtime'
import * as wasmsnark from 'wasmsnark'
import { witnessToBinary } from './converter'

export async function calculateWitness(
  wasm: Buffer,
  inputs: object,
): Promise<ArrayBuffer> {
  const wc = await circomruntime.WitnessCalculatorBuilder(wasm, {
    sanityCheck: true,
  })
  const w = await wc.calculateWitness(ffjs.utils.unstringifyBigInts(inputs))
  return witnessToBinary(ffjs.utils.stringifyBigInts(w))
}

export async function getProver(): Promise<
  (witness: ArrayBuffer, provingKey: ArrayBuffer) => Promise<any>
> {
  const bn128 = await wasmsnark.buildBn128()
  return bn128.groth16GenProof
}
