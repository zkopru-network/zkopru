import { Bytes32, Uint256 } from 'soltypes'
import { TransactionObject } from '@zkopru/contracts'
import { Block, Header } from '../block'

export type ChallengeTx = TransactionObject<{
  slash: boolean
  reason: string
  0: boolean
  1: string
}>

export interface Validation {
  slashable: boolean
  reason?: string
}

export interface OnchainValidation extends Validation {
  tx: ChallengeTx
}

export type BlockData = Block | string | Buffer
export type HeaderData = Header | string | Buffer

export interface DepositValidator {
  validateMassDeposit: (block: BlockData, index: Uint256) => Promise<Validation>
}

export interface HeaderValidator {
  validateDepositRoot: (block: BlockData) => Promise<Validation>
  validateTxRoot: (block: BlockData) => Promise<Validation>
  validateMigrationRoot: (block: BlockData) => Promise<Validation>
  validateTotalFee: (block: BlockData) => Promise<Validation>
}

export interface MigrationValidator {
  validateDuplicatedDestination: (
    block: BlockData,
    migrationIndex1: Uint256,
    migrationIndex2: Uint256,
  ) => Promise<Validation>
  validateTotalEth: (
    block: BlockData,
    migrationIndex: Uint256,
  ) => Promise<Validation>
  validateMergedLeaves: (
    block: BlockData,
    migrationIndex: Uint256,
  ) => Promise<Validation>
  validateMigrationFee: (
    block: BlockData,
    migrationIndex: Uint256,
  ) => Promise<Validation>
  validateDuplicatedERC20Migration: (
    block: BlockData,
    migrationIndex: Uint256,
    erc20Idx1: Uint256,
    erc20Idx2: Uint256,
  ) => Promise<Validation>
  validateERC20Amount: (
    block: BlockData,
    migrationIndex: Uint256,
    erc20Idx: Uint256,
  ) => Promise<Validation>
  validateDuplicatedERC721Migration: (
    block: BlockData,
    migrationIndex: Uint256,
    erc721Idx1: Uint256,
    erc721Idx2: Uint256,
  ) => Promise<Validation>
  validateNonFungibility: (
    block: BlockData,
    migrationIndex: Uint256,
    erc721Idx: Uint256,
    tokenId: Uint256,
  ) => Promise<Validation>
  validateNftExistence: (
    block: BlockData,
    migrationIndex: Uint256,
    erc721Idx: Uint256,
    tokenId: Uint256,
  ) => Promise<Validation>
}

export interface UtxoTreeValidator {
  validateUTXOIndex: (
    block: BlockData,
    parentHeader: Header,
    deposits: Uint256[],
  ) => Promise<Validation>
  validateUTXORoot: (
    block: BlockData,
    parentHeader: Header,
    deposits: Uint256[],
    initialSiblings: Uint256[],
  ) => Promise<Validation>
}

export interface WithdrawalTreeValidator {
  validateWithdrawalIndex: (
    block: BlockData,
    parentHeader: Header,
  ) => Promise<Validation>
  validateWithdrawalRoot: (
    block: BlockData,
    parentHeader: Header,
    initialSiblings: Uint256[],
  ) => Promise<Validation>
}

export interface NullifierTreeValidator {
  validateNullifierRollUp: (
    block: BlockData,
    parentHeader: Header,
    numOfNullifiers: Uint256,
    siblings: Bytes32[][],
  ) => Promise<Validation>
}

export interface TxValidator {
  validateInclusion: (
    block: BlockData,
    txIndex: Uint256,
    inflowIndex: Uint256,
  ) => Promise<Validation>
  validateOutflow: (block: BlockData, txIndex: Uint256) => Promise<Validation>
  validateAtomicSwap: (
    block: BlockData,
    txIndex: Uint256,
  ) => Promise<Validation>
  validateUsedNullifier: (
    block: BlockData,
    parentHeader: Header,
    txIndex: Uint256,
    inflowIndex: Uint256,
    siblings: Bytes32[],
  ) => Promise<Validation>
  validateDuplicatedNullifier: (
    block: BlockData,
    txIndex: Bytes32,
  ) => Promise<Validation>
  validateSNARK: (block: BlockData, txIndex: Uint256) => Promise<Validation>
}

export interface BlockValidator {
  deposit?: DepositValidator
  header?: HeaderValidator
  migration?: MigrationValidator
  utxoTree?: UtxoTreeValidator
  withdrawalTree?: WithdrawalTreeValidator
  nullifierTree?: NullifierTreeValidator
  tx?: TxValidator
}

export type FnCall = {
  name: string
  args: any[]
}

export type OnchainValidateFn =
  | {
      [x: string]: (...arg0: any[]) => Promise<OnchainValidation>
    }
  | any

export type OffchainValidateFn =
  | {
      [x: string]: (...arg0: any[]) => Promise<Validation>
    }
  | any

export type ValidateFnCalls = {
  onchainValidator: OnchainValidateFn
  offchainValidator: OffchainValidateFn
  fnCalls: FnCall[]
}
