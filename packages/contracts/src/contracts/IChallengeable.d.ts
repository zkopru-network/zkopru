/* Autogenerated file. Do not edit manually. */
/* tslint:disable */
/* eslint-disable */

import BN from 'bn.js'
import { ContractOptions } from 'web3-eth-contract'
import { EventLog } from 'web3-core'
import { EventEmitter } from 'events'
import {
  Callback,
  PayableTransactionObject,
  NonPayableTransactionObject,
  BlockType,
  ContractEventLog,
  BaseContract,
} from './types'

interface EventOptions {
  filter?: object
  fromBlock?: BlockType
  topics?: string[]
}

export type Slash = ContractEventLog<{
  blockHash: string
  proposer: string
  reason: string
  0: string
  1: string
  2: string
}>

export interface IChallengeable extends BaseContract {
  constructor(
    jsonInterface: any[],
    address?: string,
    options?: ContractOptions,
  ): IChallengeable
  clone(): IChallengeable
  methods: {}
  events: {
    Slash(cb?: Callback<Slash>): EventEmitter
    Slash(options?: EventOptions, cb?: Callback<Slash>): EventEmitter

    allEvents(options?: EventOptions, cb?: Callback<EventLog>): EventEmitter
  }

  once(event: 'Slash', cb: Callback<Slash>): void
  once(event: 'Slash', options: EventOptions, cb: Callback<Slash>): void
}
