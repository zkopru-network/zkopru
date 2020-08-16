/* eslint-disable @typescript-eslint/no-explicit-any */
/* eslint-disable max-classes-per-file */
import { Unit, soliditySha3Raw } from 'web3-utils'
import { Bytes32, Uint256, Address } from 'soltypes'
import BN from 'bn.js'

export { logger, logStream } from './logger'

export { PromptApp } from './prompt'

export { readFromContainer, getContainer, buildAndGetContainer } from './docker'

const units: Unit[] = [
  'noether',
  'wei',
  'kwei',
  'Kwei',
  'babbage',
  'femtoether',
  'mwei',
  'Mwei',
  'lovelace',
  'picoether',
  'gwei',
  'Gwei',
  'shannon',
  'nanoether',
  'nano',
  'szabo',
  'microether',
  'micro',
  'finney',
  'milliether',
  'milli',
  'ether',
  'kether',
  'grand',
  'mether',
  'gether',
  'tether',
]

export function parseStringToUnit(
  str: string,
  defaultUnit?: Unit,
): { val: string; unit: Unit } {
  const val = parseFloat(str).toString()
  const unitParser = str.match(/[\d.\-\+]*\s*(.*)/)
  const parsedUnit = (unitParser ? unitParser[1] : '') as Unit
  let unit = defaultUnit || 'ether'
  if (units.includes(parsedUnit)) {
    unit = parsedUnit
  }
  return {
    val,
    unit,
  }
}

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
        soliditySha3Raw(hashes[i * 2].toString(), zeroBytes.toString()),
      )
    } else {
      parents[i] = Bytes32.from(
        soliditySha3Raw(hashes[i * 2].toString(), hashes[i * 2 + 1].toString()),
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

export function verifyingKeyIdentifier(nI: number, nO: number): string {
  return soliditySha3Raw(nI, nO)
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
  if (byteLength) {
    if (hex.length > byteLength * 2) {
      throw Error('Input data exceeds the given length')
    }
    hex = '0'.repeat(byteLength * 2 - hex.length) + hex
  }
  return `0x${hex}`
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
  deposits: { note: Bytes32; fee: Uint256 }[],
): {
  merged: Bytes32
  fee: Uint256
} {
  let fee = new BN(0)
  let merged = ''
  for (const deposit of deposits) {
    merged = soliditySha3Raw(merged, deposit.note.toString())
    fee = fee.add(deposit.fee.toBN())
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
