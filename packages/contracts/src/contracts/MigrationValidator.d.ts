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

export interface MigrationValidator extends BaseContract {
  constructor(
    jsonInterface: any[],
    address?: string,
    options?: ContractOptions,
  ): MigrationValidator
  clone(): MigrationValidator
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
     * @param  // blockData Serialized block data
     * @param massMigrationIdx1 mass migration index in the block body
     * @param massMigrationIdx2 mass migration index in the block body that has same destination with the first mass migration
     */
    validateDuplicatedDestination(
      arg0: string | number[],
      massMigrationIdx1: number | string | BN,
      massMigrationIdx2: number | string | BN,
    ): NonPayableTransactionObject<{
      slash: boolean
      reason: string
      0: boolean
      1: string
    }>

    /**
     * @param  // blockData Serialized block data
     * @param migrationIndex Index of the mass migration to challenge
     */
    validateTotalEth(
      arg0: string | number[],
      migrationIndex: number | string | BN,
    ): NonPayableTransactionObject<{
      slash: boolean
      reason: string
      0: boolean
      1: string
    }>

    /**
     * @param  // blockData Serialized block data
     * @param migrationIndex Index of the mass migration to challenge
     */
    validateMergedLeaves(
      arg0: string | number[],
      migrationIndex: number | string | BN,
    ): NonPayableTransactionObject<{
      slash: boolean
      reason: string
      0: boolean
      1: string
    }>

    /**
     * @param  // blockData Serialized block data
     * @param migrationIndex Index of the mass migration to challenge
     */
    validateMigrationFee(
      arg0: string | number[],
      migrationIndex: number | string | BN,
    ): NonPayableTransactionObject<{
      slash: boolean
      reason: string
      0: boolean
      1: string
    }>

    validateDuplicatedERC20Migration(
      arg0: string | number[],
      migrationIndex: number | string | BN,
      erc20MigrationIdx1: number | string | BN,
      erc20MigrationIdx2: number | string | BN,
    ): NonPayableTransactionObject<{
      slash: boolean
      reason: string
      0: boolean
      1: string
    }>

    validateERC20Amount(
      arg0: string | number[],
      migrationIndex: number | string | BN,
      erc20Index: number | string | BN,
    ): NonPayableTransactionObject<{
      slash: boolean
      reason: string
      0: boolean
      1: string
    }>

    validateDuplicatedERC721Migration(
      arg0: string | number[],
      migrationIndex: number | string | BN,
      erc721MigrationIdx1: number | string | BN,
      erc721MigrationIdx2: number | string | BN,
    ): NonPayableTransactionObject<{
      slash: boolean
      reason: string
      0: boolean
      1: string
    }>

    validateNonFungibility(
      arg0: string | number[],
      migrationIndex: number | string | BN,
      erc721Index: number | string | BN,
      tokenId: number | string | BN,
    ): NonPayableTransactionObject<{
      slash: boolean
      reason: string
      0: boolean
      1: string
    }>

    validateNftExistence(
      arg0: string | number[],
      migrationIndex: number | string | BN,
      erc721Index: number | string | BN,
      tokenId: number | string | BN,
    ): NonPayableTransactionObject<{
      slash: boolean
      reason: string
      0: boolean
      1: string
    }>

    validateMissingDestination(
      arg0: string | number[],
      txIndex: number | string | BN,
      outflowIndex: number | string | BN,
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
