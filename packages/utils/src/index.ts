import { Hex, soliditySha3, padLeft } from 'web3-utils'

import * as circomruntime from 'circom_runtime'
import * as snarkjs from 'snarkjs'
import { promises as fs } from 'fs'

export function root(hashes: Hex[]): Hex {
  if (hashes.length === 0) {
    return padLeft(0, 64)
  }
  if (hashes.length === 1) {
    return hashes[0]
  }
  const parents: string[] = []
  const numOfParentNodes = Math.ceil(hashes.length / 2)
  const hasEmptyLeaf = hashes.length % 2 === 1
  for (let i = 0; i < numOfParentNodes; i += 1) {
    if (hasEmptyLeaf && i === numOfParentNodes - 1) {
      parents[i] = soliditySha3(hashes[i * 2]) || ''
    } else {
      parents[i] = soliditySha3(hashes[i * 2], hashes[i * 2 + 1]) || ''
    }
  }
  return root(parents)
}

export function verifyingKeyIdentifier(nI: number, nO: number): string {
  const identifier = soliditySha3(nI, nO)
  if (!identifier) throw Error('soliditySha3 returns null')
  return identifier
}

export class Queue {
  buffer: Buffer

  cursor: number

  constructor(buffer: Buffer) {
    this.buffer = buffer
    this.cursor = 0
  }

  dequeue(n: number): Buffer {
    const dequeued = this.buffer.slice(this.cursor, this.cursor + n)
    this.cursor += n
    return dequeued
  }
}

export async function readProvingKey(path: string): Promise<object> {
  return snarkjs.unstringifyBigInts(
    JSON.parse(await fs.readFile(path, 'utf-8')),
  )
}

export async function calculateWitness(
  wasm: Buffer,
  inputs: object,
): Promise<Buffer> {
  const wc = await circomruntime.WitnessCalculatorBuilder(wasm, undefined)
  const w = await wc.calculateWitness(inputs)
  return w
}

export async function genProof(
  provingKey: object,
  witness: Buffer,
): Promise<{ proof: any; publicSignals: any }> {
  console.log(provingKey)
  console.log(witness)
  let proof
  let publicSignals
  return { proof, publicSignals }
}
