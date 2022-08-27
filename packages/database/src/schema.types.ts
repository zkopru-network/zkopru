/* eslint-disable @typescript-eslint/ban-types */

export type EncryptedWallet = {
  id: string
  ciphertext: string
  iv: string
  algorithm: string
  keylen: number
  kdf: string
  N: number
  r: number
  p: number
  salt: string
}

export type Keystore = {
  address: string
  zkAddress: string
  encrypted: string
}

export type Config = {
  id: string
  networkId: number
  chainId: number
  address: string
  utxoTreeDepth: number
  withdrawalTreeDepth: number
  nullifierTreeDepth: number
  challengePeriod: number
  minimumStake: string
  referenceDepth: number
  maxUtxo: string
  maxWithdrawal: string
  utxoSubTreeDepth: number
  utxoSubTreeSize: number
  withdrawalSubTreeDepth: number
  withdrawalSubTreeSize: number
}

export type Tracker = {
  id: number
  viewer?: string | null
  address?: string | null
}

export type Header = {
  hash: string
  proposer: string
  parentBlock: string
  fee: string
  utxoRoot: string
  utxoIndex: string
  nullifierRoot: string
  withdrawalRoot: string
  withdrawalIndex: string
  txRoot: string
  depositRoot: string
  migrationRoot: string
}

export type Block = {
  hash: string
  header?: Object | null
  proposal?: Object | null
  bootstrap?: Object | null
  slash?: Object | null
}

export type Proposal = {
  hash: string
  proposalNum?: number | null
  canonicalNum?: number | null
  proposedAt?: number | null
  proposalTx?: string | null
  proposalData?: string | null
  timestamp?: number | null
  fetched?: string | null
  finalized?: boolean | null
  verified?: boolean | null
  isUncle?: boolean | null
  header?: Object | null
  block?: Object | null
}

export type Slash = {
  hash: string
  proposer: string
  reason: string
  executionTx: string
  slashedAt: number
  block?: Object | null
}

export type Bootstrap = {
  id: string
  blockHash?: string | null
  utxoBootstrap: string
  withdrawalBootstrap: string
  block?: Object | null
}

export type Tx = {
  hash: string
  blockHash: string
  inflowCount: number
  outflowCount: number
  fee: string
  challenged: boolean
  slashed: boolean
  senderAddress?: string | null
  receiverAddress?: string | null
  tokenAddr?: string | null
  erc20Amount?: string | null
  eth?: string | null
  proposal?: Object | null
}

export type PendingTx = {
  hash: string
  fee: string
  proof: Object
  memoVersion?: number | null
  memoData?: string | null
  swap?: string | null
  inflow: Object
  outflow: Object
  senderAddress?: string | null
  receiverAddress?: string | null
  tokenAddr?: string | null
  amount?: string | null
}

export type MassDeposit = {
  index: string
  merged: string
  fee: string
  blockNumber: number
  includedIn?: string | null
}

export type Deposit = {
  id: string
  note: string
  fee: string
  transactionIndex: number
  logIndex: number
  blockNumber: number
  queuedAt: string
  ownerAddress?: string | null
  includedIn?: string | null
  from?: string | null
  utxo?: Object | null
  proposal?: Object | null
}

export type Utxo = {
  hash: string
  eth?: string | null
  owner?: string | null
  salt?: string | null
  tokenAddr?: string | null
  erc20Amount?: string | null
  nft?: string | null
  status?: number | null
  treeId?: string | null
  index?: string | null
  nullifier?: string | null
  usedAt?: string | null
  depositedAt?: number | null
}

export type Withdrawal = {
  hash: string
  withdrawalHash: string
  eth: string
  owner?: string | null
  salt?: string | null
  tokenAddr: string
  erc20Amount: string
  nft: string
  to: string
  fee: string
  status?: number | null
  treeId?: string | null
  index?: string | null
  includedIn?: string | null
  prepayer?: string | null
  expiration?: number | null
  siblings?: string | null
  proposal?: Object | null
}

export type InstantWithdrawal = {
  signature: string
  withdrawalHash: string
  prepayFeeInEth: string
  prepayFeeInToken: string
  expiration: number
  prepayer: string
  withdrawal?: Object | null
}

export type Migration = {
  hash: string
  eth?: string | null
  owner?: string | null
  salt?: string | null
  tokenAddr?: string | null
  erc20Amount?: string | null
  nft?: string | null
  to?: string | null
  fee?: string | null
  status?: number | null
  treeId?: string | null
  index?: string | null
  usedFor?: string | null
}

export type TreeNode = {
  treeId: string
  nodeIndex: string
  value: string
}

export type LightTree = {
  id: string
  species: number
  start: string
  end: string
  root: string
  index: string
  siblings: string
}

export type TokenRegistry = {
  address: string
  isERC20: boolean
  isERC721: boolean
  identifier: number
  blockNumber: number
}

export type ERC20Info = {
  address: string
  symbol: string
  decimals: number
}
