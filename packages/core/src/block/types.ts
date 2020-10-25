import { ZkTx } from '@zkopru/transaction'
import { Address, Bytes32, Uint256 } from 'soltypes'

export interface MassDeposit {
  merged: Bytes32
  fee: Uint256
}

export interface ERC20Migration {
  addr: Address
  amount: Uint256
}

export interface ERC721Migration {
  addr: Address
  nfts: Uint256[]
}

export interface MassMigration {
  destination: Address
  totalETH: Uint256
  migratingLeaves: MassDeposit
  erc20: ERC20Migration[]
  erc721: ERC721Migration[]
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
  massMigration: MassMigration[]
}
