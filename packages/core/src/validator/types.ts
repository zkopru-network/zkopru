import { Bytes32, Uint256 } from 'soltypes'
import { Block, Header } from '../block'

export interface Slash {
  slashable: boolean
  reason?: string
}

export type BlockData = Block | string | Buffer
export type HeaderData = Header | string | Buffer

export interface DepositValidator {
  validateMassDeposit: (block: BlockData, index: Uint256) => Promise<Slash>
}

export interface HeaderValidator {
  validateDepositRoot: (block: BlockData) => Promise<Slash>
  validateTxRoot: (block: BlockData) => Promise<Slash>
  validateMigrationRoot: (block: BlockData) => Promise<Slash>
  validateTotalFee: (block: BlockData) => Promise<Slash>
}

export interface MigrationValidator {
  validateDuplicatedDestination: (
    block: BlockData,
    migrationIndex1: Uint256,
    migrationIndex2: Uint256,
  ) => Promise<Slash>
  validateTotalEth: (
    block: BlockData,
    migrationIndex: Uint256,
  ) => Promise<Slash>
  validateMergedLeaves: (
    block: BlockData,
    migrationIndex: Uint256,
  ) => Promise<Slash>
  validateMigrationFee: (
    block: BlockData,
    migrationIndex: Uint256,
  ) => Promise<Slash>
  validateDuplicatedERC20Migration: (
    block: BlockData,
    migrationIndex: Uint256,
    erc20Idx1: Uint256,
    erc20Idx2: Uint256,
  ) => Promise<Slash>
  validateERC20Amount: (
    block: BlockData,
    migrationIndex: Uint256,
    erc20Idx: Uint256,
  ) => Promise<Slash>
  validateDuplicatedERC721Migration: (
    block: BlockData,
    migrationIndex: Uint256,
    erc721Idx1: Uint256,
    erc721Idx2: Uint256,
  ) => Promise<Slash>
  validateNonFungibility: (
    block: BlockData,
    migrationIndex: Uint256,
    erc721Idx: Uint256,
    tokenId: Uint256,
  ) => Promise<Slash>
  validateNftExistence: (
    block: BlockData,
    migrationIndex: Uint256,
    erc721Idx: Uint256,
    tokenId: Uint256,
  ) => Promise<Slash>
}

export interface UtxoTreeValidator {
  validateUTXOIndex: (
    block: BlockData,
    parentHeader: Header,
    deposits: Uint256[],
  ) => Promise<Slash>
  validateUTXORoot: (
    block: BlockData,
    parentHeader: Header,
    deposits: Uint256[],
    initialSiblings: Uint256[],
  ) => Promise<Slash>
}

export interface WithdrawalTreeValidator {
  validateWithdrawalIndex: (
    block: BlockData,
    parentHeader: Header,
  ) => Promise<Slash>
  validateWithdrawalRoot: (
    block: BlockData,
    parentHeader: Header,
    initialSiblings: Uint256[],
  ) => Promise<Slash>
}

export interface NullifierTreeValidator {
  validateNullifierRollUp: (
    block: BlockData,
    parentHeader: Header,
    numOfNullifiers: Uint256,
    siblings: Bytes32[][],
  ) => Promise<Slash>
}

export interface TxValidator {
  validateInclusion: (
    block: BlockData,
    txIndex: Uint256,
    inflowIndex: Uint256,
  ) => Promise<Slash>
  validateOutflow: (block: BlockData, txIndex: Uint256) => Promise<Slash>
  validateAtomicSwap: (block: BlockData, txIndex: Uint256) => Promise<Slash>
  validateUsedNullifier: (
    block: BlockData,
    parentHeader: Header,
    txIndex: Uint256,
    inflowIndex: Uint256,
    siblings: Bytes32[],
  ) => Promise<Slash>
  validateDuplicatedNullifier: (
    block: BlockData,
    txIndex: Bytes32,
  ) => Promise<Slash>
}

export interface TxSNARKValidator {
  validateSNARK: (block: BlockData, txIndex: Uint256) => Promise<Slash>
}

export interface BlockValidator {
  deposit?: DepositValidator
  header?: HeaderValidator
  migration?: MigrationValidator
  utxoTree?: UtxoTreeValidator
  withdrawalTree?: WithdrawalTreeValidator
  nullifierTree?: NullifierTreeValidator
  tx?: TxValidator
  snark?: TxSNARKValidator
}
