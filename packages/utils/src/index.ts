/* eslint-disable @typescript-eslint/no-explicit-any */
/* eslint-disable max-classes-per-file */
import { soliditySha3, padLeft } from 'web3-utils'
import pino from 'pino'
import { Container } from 'node-docker-api/lib/container'
import { ReadStream } from 'fs-extra'
import tar from 'tar'
import BN from 'bn.js'

export { PromptApp } from './prompt'

export function root(hashes: string[]): string {
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
  const rawStr = hex.split('0x').pop() || ''
  const validHexForm = rawStr.length % 2 === 1 ? `0${rawStr}` : rawStr
  if (!len) return Buffer.from(validHexForm, 'hex')
  const buff = Buffer.from(validHexForm, 'hex')
  if (buff.length > len) {
    throw Error('Exceeds the given buffer size')
  }
  return Buffer.concat([Buffer.alloc(len - buff.length).fill(0), buff])
}

export function verifyingKeyIdentifier(nI: number, nO: number): string {
  const identifier = soliditySha3(nI, nO)
  if (!identifier) throw Error('soliditySha3 returns null')
  return identifier
}

export function hexify(n: BN | Buffer | string, length?: number): string {
  let hex: string
  if (n instanceof BN) {
    hex = n.toString(16)
  } else if (typeof n === 'string') {
    if (n.startsWith('0x')) {
      hex = n.substr(2)
    } else {
      try {
        hex = new BN(n, 16).toString(16)
      } catch (e) {
        hex = Buffer.from(n).toString('hex')
      }
    }
  } else {
    hex = n.toString('hex')
  }
  if (length) {
    if (hex.length > length * 2) {
      throw Error('Input data exceeds the given length')
    }
    hex = '0'.repeat(length * 2 - hex.length) + hex
  }
  return `0x${hex}`
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
    const dequeued = this.str.slice(this.cursor, this.cursor + n * 2)
    this.cursor += n * 2
    return `0x${dequeued}`
  }

  dequeueToNumber(n: number): number {
    const dequeued = this.str.slice(this.cursor, this.cursor + n * 2)
    this.cursor += n * 2
    return parseInt(dequeued, 16)
  }

  dequeueToBuffer(n: number): Buffer {
    const dequeued = this.str.slice(this.cursor, this.cursor + n * 2)
    this.cursor += n * 2
    return Buffer.from(dequeued, 'hex')
  }

  dequeueAll(): string {
    return `0x${this.str.slice(this.cursor)}`
  }
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

export function toArrayBuffer(buff: Buffer): ArrayBuffer {
  const arrayBuff = new ArrayBuffer(buff.length)
  const view = new Uint8Array(arrayBuff)
  for (let i = 0; i < buff.length; i += 1) {
    view[i] = buff[i]
  }
  return arrayBuff
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
