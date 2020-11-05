import { Field } from '@zkopru/babyjubjub'
import { DB, LightTree, MockupDB, TreeSpecies } from '@zkopru/prisma'
import { ZkAddress } from '@zkopru/transaction'
import { v4 } from 'uuid'
import { genesisRoot, poseidonHasher } from './hasher'
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

  zkAddressesToObserve?: ZkAddress[]

  updatePubKeys(addresses: ZkAddress[]) {
    this.zkAddressesToObserve = addresses
  }

  async indexesOfTrackingLeaves(): Promise<Field[]> {
    const keys: string[] = this.zkAddressesToObserve
      ? this.zkAddressesToObserve.map(address => address.toString())
      : []

    const trackingLeaves = await this.db.read(prisma =>
      prisma.utxo.findMany({
        where: {
          AND: [{ treeId: this.metadata.id }, { owner: { in: keys } }],
        },
      }),
    )
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

  static async sample(
    depth: number,
  ): Promise<{ tree: UtxoTree; db: MockupDB }> {
    const utxoTreeMetadata = {
      id: v4(),
      index: 1,
      species: TreeSpecies.UTXO,
      start: Field.from(0),
      end: Field.from(0),
    }
    const utxoTreeConfig: TreeConfig<Field> = {
      hasher: poseidonHasher(depth),
      forceUpdate: true,
      fullSync: true,
    }
    const preHashes = poseidonHasher(depth).preHash
    const utxoTreeInitialData = {
      root: genesisRoot(poseidonHasher(depth)),
      index: Field.zero,
      siblings: preHashes.slice(0, -1),
    }
    const mockupDB: MockupDB = await DB.mockup()
    const utxoTree = new UtxoTree({
      db: mockupDB.db,
      metadata: utxoTreeMetadata,
      data: utxoTreeInitialData,
      config: utxoTreeConfig,
    })
    await utxoTree.init()
    return {
      tree: utxoTree,
      db: mockupDB,
    }
  }
}
