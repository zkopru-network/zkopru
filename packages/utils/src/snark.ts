import * as circomruntime from 'circom_runtime'
import * as snarkjs from 'snarkjs'
import * as ffjs from 'ffjavascript'
import { Container } from 'node-docker-api/lib/container'
import { readFromContainer } from '.'

export async function calculateWitness(
  wasm: Buffer,
  inputs: object,
): Promise<string[]> {
  const wc = await circomruntime.WitnessCalculatorBuilder(wasm, {
    sanityCheck: true,
  })
  const w = await wc.calculateWitness(ffjs.utils.unstringifyBigInts(inputs))
  return ffjs.utils.stringifyBigInts(w)
}

export async function genProof(
  pk: object,
  witness: string[],
): Promise<{ proof: any; publicSignals: any }> {
  const { proof, publicSignals } = snarkjs.groth.genProof(
    ffjs.utils.unstringifyBigInts(pk),
    ffjs.utils.unstringifyBigInts(witness),
  )
  return { proof, publicSignals }
}

export async function verify(
  vk: object,
  proof: object,
  publicSignals: object,
): Promise<{ proof: any; publicSignals: any }> {
  const isValid = snarkjs.groth.isValid(
    ffjs.utils.unstringifyBigInts(vk),
    ffjs.utils.unstringifyBigInts(proof),
    ffjs.utils.unstringifyBigInts(publicSignals),
  )
  return isValid
}

export async function getZkSnarkParams(
  container: Container,
  filename: string,
): Promise<{ wasm: any; pk: any; vk: any }> {
  const name = filename.split('.circom')[0]
  const wasm = await readFromContainer(
    container,
    `/proj/build/circuits/${name}.wasm`,
  )
  const pk = JSON.parse(
    (
      await readFromContainer(container, `/proj/build/pks/${name}.pk.json`)
    ).toString('utf8'),
  )
  const vk = JSON.parse(
    (
      await readFromContainer(container, `/proj/build/vks/${name}.vk.json`)
    ).toString('utf8'),
  )
  return {
    wasm,
    pk,
    vk,
  }
}
