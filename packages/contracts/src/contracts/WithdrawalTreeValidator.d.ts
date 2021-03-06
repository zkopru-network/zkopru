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

export type OwnershipTransferred = ContractEventLog<{
  previousOwner: string
  newOwner: string
  0: string
  1: string
}>

export interface WithdrawalTreeValidator extends BaseContract {
  constructor(
    jsonInterface: any[],
    address?: string,
    options?: ContractOptions,
  ): WithdrawalTreeValidator
  clone(): WithdrawalTreeValidator
  methods: {
    CHALLENGE_PERIOD(): NonPayableTransactionObject<string>

    MAX_BLOCK_SIZE(): NonPayableTransactionObject<string>

    MAX_UTXO(): NonPayableTransactionObject<string>

    MAX_VALIDATION_GAS(): NonPayableTransactionObject<string>

    MAX_WITHDRAWAL(): NonPayableTransactionObject<string>

    MINIMUM_STAKE(): NonPayableTransactionObject<string>

    NULLIFIER_TREE_DEPTH(): NonPayableTransactionObject<string>

    REF_DEPTH(): NonPayableTransactionObject<string>

    UTXO_SUB_TREE_DEPTH(): NonPayableTransactionObject<string>

    UTXO_SUB_TREE_SIZE(): NonPayableTransactionObject<string>

    UTXO_TREE_DEPTH(): NonPayableTransactionObject<string>

    WITHDRAWAL_SUB_TREE_DEPTH(): NonPayableTransactionObject<string>

    WITHDRAWAL_SUB_TREE_SIZE(): NonPayableTransactionObject<string>

    WITHDRAWAL_TREE_DEPTH(): NonPayableTransactionObject<string>

    allowedMigrants(arg0: string): NonPayableTransactionObject<boolean>

    consensusProvider(): NonPayableTransactionObject<string>

    /**
     * Returns the address of the current owner.
     */
    owner(): NonPayableTransactionObject<string>

    proxied(arg0: string | number[]): NonPayableTransactionObject<string>

    /**
     * Leaves the contract without owner. It will not be possible to call `onlyOwner` functions anymore. Can only be called by the current owner. NOTE: Renouncing ownership will leave the contract without an owner, thereby removing any functionality that is only available to the owner.
     */
    renounceOwnership(): NonPayableTransactionObject<void>

    /**
     * Transfers ownership of the contract to a new account (`newOwner`). Can only be called by the current owner.
     */
    transferOwnership(newOwner: string): NonPayableTransactionObject<void>

    validators(arg0: string | number[]): NonPayableTransactionObject<string>

    /**
     * Challenge when the submitted block's updated withdrawal tree index is invalid.
     * @param  // parentHeader  Serialized parent header data
     */
    validateWithdrawalIndex(
      arg0: string | number[],
      arg1: string | number[],
    ): NonPayableTransactionObject<{
      slash: boolean
      reason: string
      0: boolean
      1: string
    }>

    /**
     * Challenge when the submitted block's updated withdrawal tree root is invalid.
     * @param  // parentHeader  Serialized parent header data
     * @param subTreeSiblings Submit the siblings of the starting index leaf
     */
    validateWithdrawalRoot(
      arg0: string | number[],
      arg1: string | number[],
      subTreeSiblings: (number | string | BN)[],
    ): NonPayableTransactionObject<{
      slash: boolean
      reason: string
      0: boolean
      1: string
    }>
  }
  events: {
    OwnershipTransferred(cb?: Callback<OwnershipTransferred>): EventEmitter
    OwnershipTransferred(
      options?: EventOptions,
      cb?: Callback<OwnershipTransferred>,
    ): EventEmitter

    allEvents(options?: EventOptions, cb?: Callback<EventLog>): EventEmitter
  }

  once(event: 'OwnershipTransferred', cb: Callback<OwnershipTransferred>): void
  once(
    event: 'OwnershipTransferred',
    options: EventOptions,
    cb: Callback<OwnershipTransferred>,
  ): void
}
