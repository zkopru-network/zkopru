/* Generated by ts-generator ver. 0.0.8 */
/* tslint:disable */

import BN from 'bn.js'
import { Contract, ContractOptions } from 'web3-eth-contract'
import { EventLog } from 'web3-core'
import { EventEmitter } from 'events'
import { ContractEvent, Callback, TransactionObject, BlockType } from './types'

interface EventOptions {
  filter?: object
  fromBlock?: BlockType
  topics?: string[]
}

export class ICoordinatable extends Contract {
  constructor(jsonInterface: any[], address?: string, options?: ContractOptions)
  clone(): ICoordinatable
  methods: {
    register(): TransactionObject<void>

    deregister(): TransactionObject<void>

    propose(blockData: string | number[]): TransactionObject<void>

    finalize(finalization: string | number[]): TransactionObject<void>

    withdrawReward(amount: number | string): TransactionObject<void>

    commitMassDeposit(): TransactionObject<void>

    registerERC20(tokenAddr: string): TransactionObject<void>

    registerERC721(tokenAddr: string): TransactionObject<void>

    isProposable(proposerAddr: string): TransactionObject<boolean>
  }
  events: {
    Finalized: ContractEvent<string>
    MassDepositCommit: ContractEvent<{
      index: string
      merged: string
      fee: string
      0: string
      1: string
      2: string
    }>
    NewErc20: ContractEvent<string>
    NewErc721: ContractEvent<string>
    NewProposal: ContractEvent<{
      proposalNum: string
      blockHash: string
      0: string
      1: string
    }>
    allEvents: (options?: EventOptions, cb?: Callback<EventLog>) => EventEmitter
  }
}
