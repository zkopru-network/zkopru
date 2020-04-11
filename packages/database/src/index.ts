import { block } from './block-schema'
import { output } from './output-schema'
import { chain } from './node-schema'
import { tree } from './tree-schema'
import { merkleProofCache } from './merkle-proof-cache-schema'
import { keystore } from './keystore-schema'
import { hdWallet } from './hdwallet-schema'

export const schema = {
  block,
  output,
  chain,
  tree,
  merkleProofCache,
  hdWallet,
  keystore,
}

export { TreeSql } from './tree-schema'
export { OutputSql } from './output-schema'
export { MerkleProofCacheSql } from './merkle-proof-cache-schema'
export { KeystoreSql } from './keystore-schema'
export { HDWalletSql } from './hdwallet-schema'
export { ChainConfig, NodeType } from './node-schema'
export { BlockSql, BlockStatus } from './block-schema'
