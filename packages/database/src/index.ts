import { block } from './block-schema'
import { utxo } from './output/utxo-schema'
import { withdrawal } from './output/withdrawal-schema'
import { migration } from './output/migration-schema'
import { chain } from './chain-schema'
import { deposit } from './deposit-schema'
import { utxoTree } from './tree/light-rollup-tree/utxo-tree-schema'
import { withdrawalTree } from './tree/light-rollup-tree/withdrawal-tree-schema'
import { massDeposit } from './mass-deposit-schema'
import { utxoTreeNode } from './tree/light-rollup-tree/utxo-tree-node-schema'
import { withdrawalTreeNode } from './tree/light-rollup-tree/withdrawal-tree-node-schema'
import { nullifierTreeNode } from './tree/sparse-merkle-tree/nullifier-tree-node-schema'
import { nullifiers } from './tree/sparse-merkle-tree/nullifiers-schema'
import { keystore } from './keystore-schema'
import { hdWallet } from './hdwallet-schema'

export const schema = {
  block,
  deposit,
  massDeposit,
  utxo,
  withdrawal,
  migration,
  chain,
  utxoTree,
  withdrawalTree,
  utxoTreeNode: (treeId: string) => utxoTreeNode(treeId),
  withdrawalTreeNode: (treeId: string) => withdrawalTreeNode(treeId),
  nullifiers,
  nullifierTreeNode,
  hdWallet,
  keystore,
}

export { DepositSql } from './deposit-schema'
export { MassDepositCommitSql } from './mass-deposit-schema'
export { LightRollUpTreeSql } from './tree/light-rollup-tree/light-rollup-tree-schema'
export { UtxoSql } from './output/utxo-schema'
export { WithdrawalSql } from './output/withdrawal-schema'
export { MigrationSql } from './output/migration-schema'
export { NoteSql } from './output/output-schema'
export { TreeNodeSql } from './tree/tree-node-schema'
export { KeystoreSql } from './keystore-schema'
export { HDWalletSql } from './hdwallet-schema'
export { L1Config, ChainConfig, NodeType } from './chain-schema'
export { HeaderSql, BlockSql, BlockStatus } from './block-schema'
