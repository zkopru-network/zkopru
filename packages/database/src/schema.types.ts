export type EncryptedWallet = {
  id: string;
  ciphertext: string;
  iv: string;
  algorithm: string;
  keylen: number;
  kdf: string;
  N: number;
  r: number;
  p: number;
  salt: string;
}

export type Keystore = {
  address: string;
  zkAddress: string;
  encrypted: string;
}

export type Config = {
  id: string;
  networkId: number;
  chainId: number;
  address: string;
  utxoTreeDepth: number;
  withdrawalTreeDepth: number;
  nullifierTreeDepth: number;
  challengePeriod: number;
  minimumStake: string;
  referenceDepth: number;
  maxUtxo: string;
  maxWithdrawal: string;
  utxoSubTreeDepth: number;
  utxoSubTreeSize: number;
  withdrawalSubTreeDepth: number;
  withdrawalSubTreeSize: number;
}

export type Tracker = {
  id: number;
  viewer?: string;
  address?: string;
}

export type Header = {
  hash: string;
  proposer: string;
  parentBlock: string;
  fee: string;
  utxoRoot: string;
  utxoIndex: string;
  nullifierRoot: string;
  withdrawalRoot: string;
  withdrawalIndex: string;
  txRoot: string;
  depositRoot: string;
  migrationRoot: string;
}

export type Block = {
  hash: string;
  header?: Object;
  proposal: Object;
  bootstrap?: Object;
  slash?: Object;
}

export type Proposal = {
  hash: string;
  proposalNum?: number;
  canonicalNum?: number;
  proposedAt?: number;
  proposalTx?: string;
  proposalData?: string;
  fetched?: string;
  finalized?: boolean;
  verified?: boolean;
  isUncle?: boolean;
  block?: Object;
}

export type Slash = {
  hash: string;
  proposer: string;
  reason: string;
  executionTx: string;
  slashedAt: number;
  block?: undefined;
}

export type Bootstrap = {
  id: string;
  blockHash?: string;
  utxoBootstrap: string;
  withdrawalBootstrap: string;
  block?: Object;
}

export type Tx = {
  hash: string;
  blockHash: string;
  inflowCount: number;
  outflowCount: number;
  fee: string;
  challenged: boolean;
  slashed: boolean;
}

export type MassDeposit = {
  index: string;
  merged: string;
  fee: string;
  blockNumber: number;
  includedIn?: string;
}

export type Deposit = {
  note: string;
  fee: string;
  transactionIndex: number;
  logIndex: number;
  blockNumber: number;
  queuedAt: string;
}

export type Utxo = {
  hash: string;
  eth?: string;
  owner?: string;
  salt?: string;
  tokenAddr?: string;
  erc20Amount?: string;
  nft?: string;
  status?: number;
  treeId?: string;
  index?: string;
  nullifier?: string;
  usedAt?: string;
}

export type Withdrawal = {
  hash: string;
  withdrawalHash: string;
  eth: string;
  owner?: string;
  salt?: string;
  tokenAddr: string;
  erc20Amount: string;
  nft: string;
  to: string;
  fee: string;
  status?: number;
  treeId?: string;
  index?: string;
  includedIn?: string;
  prepayer?: string;
  siblings?: string;
}

export type Migration = {
  hash: string;
  eth?: string;
  owner?: string;
  salt?: string;
  tokenAddr?: string;
  erc20Amount?: string;
  nft?: string;
  to?: string;
  fee?: string;
  status?: number;
  treeId?: string;
  index?: string;
  usedFor?: string;
}

export type TreeNode = {
  treeId: string;
  nodeIndex: string;
  value: string;
}

export type LightTree = {
  id: string;
  species: number;
  start: string;
  end: string;
  root: string;
  index: string;
  siblings: string;
}

export type TokenRegistry = {
  address: string;
  isERC20: boolean;
  isERC721: boolean;
  identifier: number;
  blockNumber: number;
}
