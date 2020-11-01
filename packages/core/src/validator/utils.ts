import * as Utils from '@zkopru/utils'
import { logger } from '@zkopru/utils'
import { Block, Header, serializeHeader } from '../block'
import {
  BlockData,
  ChallengeTx,
  FnCall,
  HeaderData,
  OffchainValidateFn,
  OnchainValidateFn,
  OnchainValidation,
  Validation,
} from './types'

export function blockDataToHexString(data: BlockData): string {
  // When data is string type.
  if (typeof data === 'string') return data
  // If data is Block instance, convert it to a buffer value.
  const buffer: Buffer = data instanceof Buffer ? data : data.serializeBlock()
  // Return 0x prefixed hex value.
  return `0x${buffer.toString('hex')}`
}

export function blockDataToBlock(data: BlockData): Block {
  if (typeof data === 'string' || data instanceof Buffer) {
    return Block.from(data)
  }
  return data
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

export function toFnCall(name: string, ...args: any[]): FnCall {
  return {
    name,
    args,
  }
}

export async function validateBothOnAndOff(
  onchainValidator: OnchainValidateFn,
  offchainValidator: OffchainValidateFn,
  fnCalls: FnCall[],
): Promise<ChallengeTx | undefined> {
  const offchainResult: Validation[] = await Promise.all(
    fnCalls.map(funcs => offchainValidator[funcs.name](...funcs.args)),
  )
  const onchainResult: OnchainValidation[] = await Promise.all(
    fnCalls.map(funcs => onchainValidator[funcs.name](...funcs.args)),
  )
  if (
    !offchainResult.every(
      (result, index) => result.slashable === onchainResult[index].slashable,
    )
  ) {
    logger.error(
      'Offchain validation and onchain validation is showing different results',
    )
  }
  return onchainResult.find(res => res.slashable)?.tx
}

export async function validateOnchain(
  onchainValidator: OnchainValidateFn,
  fnCalls: FnCall[],
): Promise<ChallengeTx | undefined> {
  const onchainResult: OnchainValidation[] = await Promise.all(
    fnCalls.map(funcs => onchainValidator[funcs.name](...funcs.args)),
  )
  return onchainResult.find(res => res.slashable)?.tx
}

export async function validateOffchain(
  offchainValidator: OffchainValidateFn,
  fnCalls: FnCall[],
): Promise<FnCall | undefined> {
  if (fnCalls.length === 0) return undefined
  const offchainResult: Validation[] = await Promise.all(
    fnCalls.map(funcs => offchainValidator[funcs.name](...funcs.args)),
  )
  const i = offchainResult.findIndex(res => res.slashable)
  if (i >= 0) {
    return fnCalls[i]
  }
  return undefined
}
