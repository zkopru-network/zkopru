import { schema, LightRollUpTreeSql } from '@zkopru/database'
import { InanoSQLInstance } from '@nano-sql/core'
import BN from 'bn.js'
import { toBN } from 'web3-utils'
import {
  LightRollUpTree,
  TreeMetadata,
  TreeData,
  TreeConfig,
} from './light-rollup-tree'

export class WithdrawalTree extends LightRollUpTree<BN> {
  zero = toBN(0)

  addressesToObserve?: string[]

  updateAddresses(addresses: string[]) {
    this.addressesToObserve = addresses
  }

  async indexesOfTrackingLeaves(): Promise<BN[]> {
    const keys: string[] = this.addressesToObserve || []
    const trackingLeaves = await this.db
      .selectTable(this.itemSchema.name)
      .presetQuery('withdrawalsToTrack', {
        tree: this.metadata.id,
        keys,
      })
      .exec()
    return trackingLeaves.map(row => toBN(row.index))
  }

  static async bootstrap({
    db,
    metadata,
    data,
    config,
  }: {
    db: InanoSQLInstance
    metadata: TreeMetadata<BN>
    data: TreeData<BN>
    config: TreeConfig<BN>
  }): Promise<WithdrawalTree> {
    const initialData = await LightRollUpTree.initTreeFromDatabase({
      db,
      metadata,
      data,
      config,
      treeSchema: schema.withdrawalTree,
    })
    return new WithdrawalTree({
      ...initialData,
      itemSchema: schema.withdrawal,
      treeSchema: schema.withdrawalTree,
      treeNodeSchema: schema.withdrawalTreeNode(metadata.id),
    })
  }

  static from(
    db: InanoSQLInstance,
    obj: LightRollUpTreeSql,
    config: TreeConfig<BN>,
  ): WithdrawalTree {
    return new WithdrawalTree({
      db,
      metadata: {
        id: obj.id,
        index: obj.index,
        zkopruId: obj.zkopru,
        start: toBN(obj.start),
        end: toBN(obj.end),
      },
      itemSchema: schema.withdrawal,
      treeSchema: schema.withdrawalTree,
      treeNodeSchema: schema.withdrawalTreeNode(obj.id),
      data: {
        root: toBN(obj.data.root),
        index: toBN(obj.data.index),
        siblings: obj.data.siblings.map(toBN),
      },
      config,
    })
  }
}
