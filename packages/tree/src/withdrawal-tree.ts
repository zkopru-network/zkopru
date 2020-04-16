import { Field } from '@zkopru/babyjubjub'
import { schema, LightRollUpTreeSql } from '@zkopru/database'
import { InanoSQLInstance } from '@nano-sql/core'
import {
  LightRollUpTree,
  TreeMetadata,
  TreeData,
  TreeConfig,
} from './light-rollup-tree'

export class WithdrawalTree extends LightRollUpTree {
  addressesToObserve?: string[]

  updateAddresses(addresses: string[]) {
    this.addressesToObserve = addresses
  }

  async indexesOfTrackingLeaves(): Promise<Field[]> {
    const keys: string[] = this.addressesToObserve || []
    const trackingLeaves = await this.db
      .selectTable(this.itemSchema.name)
      .presetQuery('withdrawalsToTrack', {
        tree: this.metadata.id,
        keys,
      })
      .exec()
    return trackingLeaves.map(row => Field.from(row.index))
  }

  static async bootstrap({
    db,
    metadata,
    data,
    config,
  }: {
    db: InanoSQLInstance
    metadata: TreeMetadata
    data: TreeData
    config: TreeConfig
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
    config: TreeConfig,
  ): WithdrawalTree {
    return new WithdrawalTree({
      db,
      metadata: {
        id: obj.id,
        index: obj.index,
        zkopruId: obj.zkopru,
        start: Field.from(obj.start),
        end: Field.from(obj.end),
      },
      itemSchema: schema.withdrawal,
      treeSchema: schema.withdrawalTree,
      treeNodeSchema: schema.withdrawalTreeNode(obj.id),
      data: {
        root: Field.from(obj.data.root),
        index: Field.from(obj.data.index),
        siblings: obj.data.siblings.map(sib => Field.from(sib)),
      },
      config,
    })
  }
}
