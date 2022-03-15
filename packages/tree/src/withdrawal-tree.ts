import { DB, LightTree, TreeSpecies } from '@zkopru/database'
import { BigNumber } from 'ethers'
import {
  LightRollUpTree,
  TreeMetadata,
  TreeData,
  TreeConfig,
} from './light-rollup-tree'
import { TreeCache } from './utils'

export class WithdrawalTree extends LightRollUpTree<BigNumber> {
  zero = BigNumber.from(0)

  addressesToObserve?: string[]

  constructor(conf: {
    db: DB
    metadata: TreeMetadata<BigNumber>
    data: TreeData<BigNumber>
    config: TreeConfig<BigNumber>
    treeCache: TreeCache
  }) {
    super({ ...conf, species: TreeSpecies.WITHDRAWAL })
  }

  updateAddresses(addresses: string[]) {
    this.addressesToObserve = addresses
  }

  async indexesOfTrackingLeaves(): Promise<BigNumber[]> {
    const keys: string[] = this.addressesToObserve || []

    const trackingLeaves = await this.db.findMany('Withdrawal', {
      where: {
        treeId: this.metadata.id,
        OR: [{ to: keys }, { prepayer: keys }],
      },
    })
    return trackingLeaves
      .filter(leaf => leaf.index !== null)
      .map(leaf => BigNumber.from(leaf.index as string))
  }

  static async bootstrap({
    db,
    metadata,
    data,
    config,
    treeCache,
  }: {
    db: DB
    metadata: TreeMetadata<BigNumber>
    data: TreeData<BigNumber>
    config: TreeConfig<BigNumber>
    treeCache: TreeCache
  }): Promise<WithdrawalTree> {
    const initialData = await LightRollUpTree.initTreeFromDatabase({
      db,
      species: TreeSpecies.WITHDRAWAL,
      metadata,
      data,
      config,
    })
    return new WithdrawalTree({ ...initialData, treeCache })
  }

  static from(
    db: DB,
    obj: LightTree,
    config: TreeConfig<BigNumber>,
    treeCache: TreeCache,
  ): WithdrawalTree {
    return new WithdrawalTree({
      db,
      metadata: {
        id: obj.id,
        species: obj.species,
        start: BigNumber.from(obj.start),
        end: BigNumber.from(obj.end),
      },
      data: {
        root: BigNumber.from(obj.root),
        index: BigNumber.from(obj.index),
        siblings: JSON.parse(obj.siblings).map(s => BigNumber.from(s)),
      },
      config,
      treeCache,
    })
  }
}
