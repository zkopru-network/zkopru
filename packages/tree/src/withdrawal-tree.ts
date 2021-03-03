import { DB, LightTree, TreeSpecies } from '@zkopru/database'
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

  constructor(conf: {
    db: DB
    metadata: TreeMetadata<BN>
    data: TreeData<BN>
    config: TreeConfig<BN>
  }) {
    super({ ...conf, species: TreeSpecies.WITHDRAWAL })
  }

  updateAddresses(addresses: string[]) {
    this.addressesToObserve = addresses
  }

  async indexesOfTrackingLeaves(): Promise<BN[]> {
    const keys: string[] = this.addressesToObserve || []

    const trackingLeaves = await this.db.findMany('Withdrawal', {
      where: {
        treeId: this.metadata.id,
        OR: [
          { to: keys, },
          { prepayer: keys, },
        ]
      }
    })
    return trackingLeaves
      .filter(leaf => leaf.index !== null)
      .map(leaf => toBN(leaf.index as string))
  }

  static async bootstrap({
    db,
    metadata,
    data,
    config,
  }: {
    db: DB
    metadata: TreeMetadata<BN>
    data: TreeData<BN>
    config: TreeConfig<BN>
  }): Promise<WithdrawalTree> {
    const initialData = await LightRollUpTree.initTreeFromDatabase({
      db,
      species: TreeSpecies.WITHDRAWAL,
      metadata,
      data,
      config,
    })
    return new WithdrawalTree({ ...initialData })
  }

  static from(db: DB, obj: LightTree, config: TreeConfig<BN>): WithdrawalTree {
    return new WithdrawalTree({
      db,
      metadata: {
        id: obj.id,
        species: obj.species,
        start: toBN(obj.start),
        end: toBN(obj.end),
      },
      data: {
        root: toBN(obj.root),
        index: toBN(obj.index),
        siblings: JSON.parse(obj.siblings).map(toBN),
      },
      config,
    })
  }
}
