import { Fp } from '@zkopru/babyjubjub'
import { DB, LightTree, TreeSpecies, TreeCache } from '@zkopru/database'
import { ZkAddress } from '@zkopru/transaction'
import {
  LightRollUpTree,
  TreeMetadata,
  TreeData,
  TreeConfig,
} from './light-rollup-tree'

export class UtxoTree extends LightRollUpTree<Fp> {
  constructor(conf: {
    db: DB
    metadata: TreeMetadata<Fp>
    data: TreeData<Fp>
    config: TreeConfig<Fp>
    treeCache: TreeCache
  }) {
    super({ ...conf, species: TreeSpecies.UTXO })
  }

  zero = Fp.zero

  zkAddressesToObserve?: ZkAddress[]

  updatePubKeys(addresses: ZkAddress[]) {
    this.zkAddressesToObserve = addresses
  }

  async indexesOfTrackingLeaves(): Promise<Fp[]> {
    const keys: string[] = this.zkAddressesToObserve
      ? this.zkAddressesToObserve.map(address => address.toString())
      : []

    const trackingLeaves = await this.db.findMany('Utxo', {
      where: {
        treeId: this.metadata.id,
        owner: keys,
      },
    })
    return trackingLeaves
      .filter(leaf => leaf.index !== null)
      .map(leaf => Fp.from(leaf.index as string))
  }

  static async bootstrap({
    db,
    metadata,
    data,
    config,
    treeCache,
  }: {
    db: DB
    metadata: TreeMetadata<Fp>
    data: TreeData<Fp>
    config: TreeConfig<Fp>
    treeCache: TreeCache
  }): Promise<UtxoTree> {
    const initialData = await LightRollUpTree.initTreeFromDatabase({
      db,
      species: TreeSpecies.UTXO,
      metadata,
      data,
      config,
    })
    return new UtxoTree({ ...initialData, treeCache })
  }

  static from(
    db: DB,
    obj: LightTree,
    config: TreeConfig<Fp>,
    treeCache: TreeCache,
  ): UtxoTree {
    return new UtxoTree({
      db,
      metadata: {
        id: obj.id,
        species: obj.species,
        start: Fp.from(obj.start),
        end: Fp.from(obj.end),
      },
      data: {
        root: Fp.from(obj.root),
        index: Fp.from(obj.index),
        siblings: JSON.parse(obj.siblings).map(sib => Fp.from(sib)),
      },
      config,
      treeCache,
    })
  }
}
