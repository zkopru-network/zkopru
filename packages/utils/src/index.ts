/* eslint-disable max-classes-per-file */
import { Hex, soliditySha3, padLeft } from 'web3-utils'
import pino from 'pino'
import { Container } from 'node-docker-api/lib/container'
import { ReadStream } from 'fs-extra'
import tar from 'tar'
import * as circomruntime from 'circom_runtime'
import * as snarkjs from 'snarkjs'
import * as ffjs from 'ffjavascript'
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

export async function readFromContainer(
  container: Container,
  path: string,
): Promise<Buffer> {
  const data: any[] = []
  const stream: ReadStream = (await container.fs.get({ path })) as ReadStream
  return new Promise<Buffer>(res => {
    stream.pipe(
      tar.t({
        onentry: entry => {
          entry.on('data', c => data.push(c))
          entry.on('end', () => {
            res(Buffer.concat(data))
          })
        },
      }),
    )
  })
}

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

export const logger = pino({
  name: 'zkopru',
  level: 'debug',
  prettyPrint: {
    translateTime: true,
    colorize: true,
  },
})

export function sleep(ms: number) {
  return new Promise(res => {
    setTimeout(res, ms)
  })
}
