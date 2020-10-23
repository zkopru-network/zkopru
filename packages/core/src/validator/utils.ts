import * as Utils from '@zkopru/utils'
import { Block, Header, serializeHeader } from '../block'
import { BlockData, HeaderData } from './types'

export function blockDataToHexString(data: BlockData): string {
  // When data is string type.
  if (typeof data === 'string') return data
  // If data is Block instance, convert it to a buffer value.
  const buffer: Buffer = data instanceof Buffer ? data : data.serializeBlock()
  // Return 0x prefixed hex value.
  return `0x${buffer.toString('hex')}`
}

export function blockDataToBlock(data: BlockData): Block {
  if (data instanceof Block) return data
  const block = Block.from(data)
  return block
}

export function headerDataToHexString(data: HeaderData): string {
  // When data is string type.
  if (typeof data === 'string') return data
  // If data is header instance, convert it to a buffer value.
  const buffer: Buffer = data instanceof Buffer ? data : serializeHeader(data)
  // Return 0x prefixed hex value.
  return `0x${buffer.toString('hex')}`
}

export function headerDataToHeader(data: HeaderData): Header {
  // When data is string type.
  if (typeof data !== 'string' && !(data instanceof Buffer)) {
    return data
  }

  const queue = new Utils.StringifiedHexQueue(headerDataToHexString(data))
  const header: Header = {
    proposer: queue.dequeueToAddress(),
    parentBlock: queue.dequeueToBytes32(),
    fee: queue.dequeueToUint256(),
    utxoRoot: queue.dequeueToUint256(),
    utxoIndex: queue.dequeueToUint256(),
    nullifierRoot: queue.dequeueToBytes32(),
    withdrawalRoot: queue.dequeueToUint256(),
    withdrawalIndex: queue.dequeueToUint256(),
    txRoot: queue.dequeueToBytes32(),
    depositRoot: queue.dequeueToBytes32(),
    migrationRoot: queue.dequeueToBytes32(),
  }
  return header
}
