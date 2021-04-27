import { ZkTx } from '@zkopru/transaction'
import { Address, Bytes32, Uint256 } from 'soltypes'

export interface MassDeposit {
  merged: Bytes32
  fee: Uint256
}

export interface MigrationAsset {
  eth: Uint256
  token: Address
  amount: Uint256
}

export interface MassMigration {
  destination: Address
  asset: MigrationAsset
  depositForDest: MassDeposit
}

export interface Header {
  proposer: Address
  parentBlock: Bytes32
  fee: Uint256
  utxoRoot: Uint256
  utxoIndex: Uint256
  withdrawalRoot: Uint256
  withdrawalIndex: Uint256
  nullifierRoot: Bytes32
  txRoot: Bytes32
  depositRoot: Bytes32
  migrationRoot: Bytes32
}

export interface Body {
  txs: ZkTx[]
  massDeposits: MassDeposit[]
  massMigrations: MassMigration[]
}

export interface Finalization {
  proposalChecksum: Bytes32
  header: Header
  massDeposits: MassDeposit[]
}
