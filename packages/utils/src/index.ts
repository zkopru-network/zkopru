/* eslint-disable @typescript-eslint/no-explicit-any */
/* eslint-disable max-classes-per-file */
import path from 'path'
import { Bytes32, Uint256, Address } from 'soltypes'
import BN from 'bn.js'
import axios from 'axios'
import { BigNumber, ethers, utils } from 'ethers'

export { logger, logStream, attachConsoleLogToPino } from './logger'

export { prepayHash } from './eip712'

export { PromptApp } from './prompt'

export { Worker } from './worker'

export { getL2PrivateKeyBySignature } from './l2Keypair'

export function txSizeCalculator(
  inflowNum: number,
  outflowNum: number,
  crossLayerOutflowNum: number,
  hasSwap?: boolean,
  noMemo?: boolean,
): number {
  let size = 0
  size += 1 // inflow num length
  size += inflowNum * 32 // inflow root
  size += inflowNum * 32 // inflow nullifier
  size += 1 // outflow num length
  size += outflowNum * 32 // outflow note hash
  size += outflowNum * 1 // outflow type identifier
  size += crossLayerOutflowNum * 20 // cross-layer outflow has 'to' address data
  size += crossLayerOutflowNum * 32 // cross-layer outflow has 'th data
  size += crossLayerOutflowNum * 20 // cross-layer outflow has token address data
  size += crossLayerOutflowNum * 32 // cross-layer outflow has token amount
  size += crossLayerOutflowNum * 32 // cross-layer outflow has nft id
  size += crossLayerOutflowNum * 32 // cross-layer outflow has fee
  size += 1 // swap & memo indicator
  size += hasSwap ? 32 : 0 // note hash to swap with
  size += noMemo ? 0 : 81 // note hash to swap
  size += 256 // snark proof size
  return size
}

export function root(hashes: Bytes32[]): Bytes32 {
  const zeroBytes = Bytes32.from(
    '0x0000000000000000000000000000000000000000000000000000000000000000',
  )
  if (hashes.length === 0) {
    return zeroBytes
  }
  if (hashes.length === 1) {
    return hashes[0]
  }
  const parents: Bytes32[] = []
  const numOfParentNodes = Math.ceil(hashes.length / 2)
  const hasEmptyLeaf = hashes.length % 2 === 1
  for (let i = 0; i < numOfParentNodes; i += 1) {
    if (hasEmptyLeaf && i === numOfParentNodes - 1) {
      parents[i] = Bytes32.from(
        utils.keccak256(
          Buffer.concat([hashes[i * 2].toBuffer(), hashes[i * 2].toBuffer()]),
        ),
      )
    } else {
      parents[i] = Bytes32.from(
        utils.keccak256(
          Buffer.concat([
            hashes[i * 2].toBuffer(),
            hashes[i * 2 + 1].toBuffer(),
          ]),
        ),
      )
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

export function hexify(
  n: BN | Buffer | string | number,
  byteLength?: number,
): string {
  let hex: string
  if (n instanceof BN || typeof n === 'number') {
    hex = n.toString(16)
  } else if (typeof n === 'string') {
    if (n.startsWith('0x')) {
      hex = n.substring(2)
    } else {
      if (/[a-fA-F]/.test(n)) {
        throw new Error('Detected hex value in expected decimal string')
      }
      hex = new BN(n).toString(16)
    }
  } else {
    hex = n.toString('hex')
  }
  if (byteLength) {
    if (hex.length > byteLength * 2) {
      throw Error('Input data exceeds the given length')
    }
    hex = '0'.repeat(byteLength * 2 - hex.length) + hex
  }
  return `0x${hex}`
}

export function trimHexToLength(
  hexstring: string | Buffer,
  targetLength: number,
) {
  const rawString = (typeof hexstring === 'string'
    ? hexstring
    : hexstring.toString('hex')
  ).replace('0x', '')
  const reducedString = rawString.slice(0, targetLength)
  const filledString = [
    reducedString,
    ...Array(targetLength - reducedString.length)
      .fill(null)
      .map(() => '0'),
  ].join('')
  return `0x${filledString}`
}

export function numToBuffer(
  decimal: BN | string | number,
  len?: number,
): Buffer {
  if (typeof decimal === 'string' && decimal.startsWith('0x')) {
    throw Error('It starts with 0x. This is not a number')
  }
  return hexToBuffer(hexify(decimal), len)
}

export function bnToBytes32(n: BN): Bytes32 {
  return Bytes32.from(`0x${n.toString(16, 64)}`)
}

export function bnToUint256(n: BN): Uint256 {
  return bnToBytes32(n).toUint()
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

export function mergeDeposits(
  deposits: { note: Bytes32 | string; fee: Uint256 | string }[],
): {
  merged: Bytes32
  fee: Uint256
} {
  let fee = new BN(0)
  let merged = ethers.constants.HashZero

  for (const deposit of deposits) {
    merged = utils.keccak256(
      utils.defaultAbiCoder.encode(
        ['bytes32', 'uint256'],
        [merged, BigNumber.from(deposit.note)],
      ),
    )
    fee = fee.add(new BN(deposit.fee.toString()))
  }
  return {
    merged: Bytes32.from(merged),
    fee: Uint256.from(fee.toString(10)),
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

  dequeueToAddress(): Address {
    return Address.from(this.dequeue(20))
  }

  dequeueToBytes32(): Bytes32 {
    return Bytes32.from(this.dequeue(32))
  }

  dequeueToUint256(): Uint256 {
    return this.dequeueToBytes32().toUint()
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

  dequeueAllToBuffer() {
    return Buffer.from(this.str.slice(this.cursor), 'hex')
  }

  dequeueAll(): string {
    return `0x${this.str.slice(this.cursor)}`
  }
}

export function toArrayBuffer(buff: Buffer): ArrayBuffer {
  const arrayBuff = new ArrayBuffer(buff.length)
  const view = new Uint8Array(arrayBuff)
  for (let i = 0; i < buff.length; i += 1) {
    view[i] = buff[i]
  }
  return arrayBuff
}

export function sleep(ms: number) {
  return new Promise(res => {
    setTimeout(res, ms)
  })
}

export function jestExtendToCompareBigNumber(expect: jest.Expect) {
  expect.extend({
    toBe(received: BN, expected: BN) {
      const pass = received.eq(expected)
      const message = pass
        ? `expected ${received.toString()} not to be equal to ${expected.toString()}`
        : `expected ${received.toString()} to be equal to ${expected.toString()}`
      return {
        message: () => message,
        pass,
      }
    },
  })
}

export function makePathAbsolute(filepath: string) {
  if (path.isAbsolute(filepath)) return filepath
  return path.join(process.cwd(), filepath)
}

const HostRegex = /(?=^.{4,253}$)(^((?!-)[a-zA-Z0-9-]{0,62}[a-zA-Z0-9]\.)+[a-zA-Z]{2,63}$)/
const IP4Regex = /^((25[0-5]|(2[0-4]|1[0-9]|[1-9]|)[0-9])(\.(?!$)|$)){4}$/
const PortRegex = /^[0-9]+$/
export function validatePublicUrls(publicUrls: string) {
  if (!publicUrls)
    throw new Error('Public urls cannot be empty for a coordinator')
  for (const url of publicUrls.split(',')) {
    const [host, port] = url.split(':')
    if (!host || !port) {
      throw new Error(`Missing host or port in public url: ${url}`)
    }
    if (!HostRegex.test(host) && !IP4Regex.test(host) && host !== 'localhost') {
      throw new Error(`Invalid public url host or ip supplied: ${url}`)
    }
    if (!PortRegex.test(port)) {
      throw new Error(`Invalid public url port supplied: ${url}`)
    }
  }
}

export async function externalIp() {
  const {
    data: { ip },
  } = await axios.get('https://external-ip.now.sh')
  return ip
}
