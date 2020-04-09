import { block } from './block'
import { output } from './output'
import { zkopru } from './zkopru'
import { tree } from './tree'
import { merkleProofCache } from './merkle-proof-cache'
import { keystore } from './keystore'
import { hdWallet } from './hdwallet'

export const schema = {
  block,
  output,
  zkopru,
  tree,
  merkleProofCache,
  hdWallet,
  keystore,
}

export { TreeSql } from './tree'
export { OutputSql } from './output'
export { MerkleProofCacheSql } from './merkle-proof-cache'
export { KeystoreSql } from './keystore'
export { HDWalletSql } from './hdwallet'
export { ZkOPRUSql } from './zkopru'
export { BlockSql, BlockStatus } from './block'
