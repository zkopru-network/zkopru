/* eslint-disable max-classes-per-file */
import { Hex, soliditySha3, padLeft } from 'web3-utils'
import pino from 'pino'

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

export function hexToBuffer(hex: string, len?: number): Buffer {
  if (!len) return Buffer.from(hex.split('0x').pop() || '', 'hex')
  const buff = Buffer.from(hex.split('0x').pop() || '', 'hex')
  if (buff.length > len) throw Error('Exceeds the given buffer size')
  return Buffer.concat([Buffer.alloc(len - buff.length).fill(0), buff])
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

export class StringifiedHexQueue {
  str: string

  cursor: number

  constructor(str: string) {
    this.str = str.split('0x').pop() || ''
    this.cursor = 0
  }

  dequeue(n: number): string {
    const dequeued = this.str.slice(this.cursor, this.cursor + n)
    this.cursor += n
    return `0x${dequeued}`
  }

  dequeueToNumber(n: number): number {
    const dequeued = this.str.slice(this.cursor, this.cursor + n)
    this.cursor += n
    return parseInt(dequeued, 16)
  }

  dequeueToBuffer(n: number): Buffer {
    const dequeued = this.str.slice(this.cursor, this.cursor + n)
    this.cursor += n
    return Buffer.from(dequeued, 'hex')
  }

  dequeueAll(): string {
    return `0x${this.str.slice(this.cursor)}`
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

export const logger = pino({
  name: 'zkopru',
  level: 'debug',
  prettyPrint: {
    translateTime: true,
    colorize: true,
  },
})
