import { Field, Point } from '@zkopru/babyjubjub'
import { DB, LightTree, TreeSpecies } from '@zkopru/prisma'
import {
  LightRollUpTree,
  TreeMetadata,
  TreeData,
  TreeConfig,
} from './light-rollup-tree'

export class UtxoTree extends LightRollUpTree<Field> {
  constructor(conf: {
    db: DB
    metadata: TreeMetadata<Field>
    data: TreeData<Field>
    config: TreeConfig<Field>
  }) {
    super({ ...conf, species: TreeSpecies.UTXO })
  }

  zero = Field.zero

  pubKeysToObserve?: Point[]

  updatePubKeys(pubKeys: Point[]) {
    this.pubKeysToObserve = pubKeys
  }

  async indexesOfTrackingLeaves(): Promise<Field[]> {
    const keys: string[] = this.pubKeysToObserve
      ? this.pubKeysToObserve.map(point => point.toHex())
      : []

    const trackingLeaves = await this.db.prisma.note.findMany({
      where: {
        treeId: this.metadata.id,
        pubKey: { in: keys },
      },
    })
    return trackingLeaves
      .filter(leaf => leaf.index !== null)
      .map(leaf => Field.from(leaf.index as string))
  }

  static async bootstrap({
    db,
    metadata,
    data,
    config,
  }: {
    db: DB
    metadata: TreeMetadata<Field>
    data: TreeData<Field>
    config: TreeConfig<Field>
  }): Promise<UtxoTree> {
    const initialData = await LightRollUpTree.initTreeFromDatabase({
      db,
      species: TreeSpecies.UTXO,
      metadata,
      data,
      config,
    })
    return new UtxoTree({ ...initialData })
  }

  static from(db: DB, obj: LightTree, config: TreeConfig<Field>): UtxoTree {
    return new UtxoTree({
      db,
      metadata: {
        id: obj.id,
        species: obj.species,
        index: obj.treeIndex,
        start: Field.from(obj.start),
        end: Field.from(obj.end),
      },
      data: {
        root: Field.from(obj.root),
        index: Field.from(obj.index),
        siblings: JSON.parse(obj.siblings).map(sib => Field.from(sib)),
      },
      config,
    })
  }
}
