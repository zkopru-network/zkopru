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

export { TreeSqlObj } from './tree'
export { OutputSqlObject } from './output'
export { MerkleProofCacheSqlObject } from './merkle-proof-cache'
export { KeystoreSqlObj } from './keystore'
export { HDWalletSqlObj } from './hdwallet'
