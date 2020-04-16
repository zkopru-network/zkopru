import { Field, Point } from '@zkopru/babyjubjub'
import { schema, LightRollUpTreeSql } from '@zkopru/database'
import { InanoSQLInstance } from '@nano-sql/core'
import {
  LightRollUpTree,
  TreeMetadata,
  TreeData,
  TreeConfig,
} from './light-rollup-tree'

export class UtxoTree extends LightRollUpTree {
  pubKeysToObserve?: Point[]

  updatePubKeys(pubKeys: Point[]) {
    this.pubKeysToObserve = pubKeys
  }

  async indexesOfTrackingLeaves(): Promise<Field[]> {
    const keys: string[] = this.pubKeysToObserve
      ? this.pubKeysToObserve.map(point => point.toHex())
      : []
    const trackingLeaves = await this.db
      .selectTable(this.itemSchema.name)
      .presetQuery('utxosToTrack', {
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
  }): Promise<UtxoTree> {
    const initialData = await LightRollUpTree.initTreeFromDatabase({
      db,
      metadata,
      data,
      config,
      treeSchema: schema.utxoTree,
    })
    return new UtxoTree({
      ...initialData,
      itemSchema: schema.utxo,
      treeSchema: schema.utxoTree,
      treeNodeSchema: schema.utxoTreeNode(metadata.id),
    })
  }

  static from(
    db: InanoSQLInstance,
    obj: LightRollUpTreeSql,
    config: TreeConfig,
  ): UtxoTree {
    return new UtxoTree({
      db,
      metadata: {
        id: obj.id,
        index: obj.index,
        zkopruId: obj.zkopru,
        start: Field.from(obj.start),
        end: Field.from(obj.end),
      },
      itemSchema: schema.utxo,
      treeSchema: schema.utxoTree,
      treeNodeSchema: schema.utxoTreeNode(obj.id),
      data: {
        root: Field.from(obj.data.root),
        index: Field.from(obj.data.index),
        siblings: obj.data.siblings.map(sib => Field.from(sib)),
      },
      config,
    })
  }
}
