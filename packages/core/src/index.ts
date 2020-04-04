// eslint-disable-next-line prettier/prettier

import {
  Field,
  Point,
  signEdDSA,
  verifyEdDSA,
} from './crypto'

import {
  UTXO,
  UTXOStatus,
  TxBuilder,
  ZkTx
} from './transaction'

import {
  root,
  Queue,
  readProvingKey,
  calculateWitness,
  genProof,
} from './utils'


export { UTXO } from './transaction/utxo'
// eslint-disable-next-line prettier/prettier
export * as TokenUtils from './transaction/tokens'
export { Field, F } from './crypto/field'
export { Spendable } from './transaction/spendable'
export {
  RawTx,
  TxBuilder
} from './transaction/tx'
export {
  ZkInflow,
  ZkOutflow,
  PublicData,
  SNARK,
  ZkTx,
} from './transaction/zk_tx'

export * as Utils from './utils'

export {
  Grove,
  Hasher,
  MerkleProof,
  LightRollUpTree,
  Bootstrap,
  Item,
  merkleProof,
  startingLeafProof,
} from './tree'

export {
  ZkOPRUConfig,
  ZkOPRU
} from './blockchain/zkopru'

export const jubjub = {
  Field, Point, signEdDSA, verifyEdDSA
}

export const tx = {
  UTXO,
  UTXOStatus,
  TxBuilder,
  ZkTx,
}

export const utils = {
  root,
  Queue,
  readProvingKey,
  calculateWitness,
  genProof,
}

const zkopru = {
  jubjub,
  tx,
  utils,
}

export default zkopru
