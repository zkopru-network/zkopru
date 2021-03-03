import { Fp } from '@zkopru/babyjubjub'
import { DB, LightTree, TreeSpecies, SQLiteConnector, schema } from '@zkopru/database'
import { ZkAddress } from '@zkopru/transaction'
import { v4 } from 'uuid'
import { genesisRoot, poseidonHasher } from './hasher'
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
      }
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
  }: {
    db: DB
    metadata: TreeMetadata<Fp>
    data: TreeData<Fp>
    config: TreeConfig<Fp>
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

  static from(db: DB, obj: LightTree, config: TreeConfig<Fp>): UtxoTree {
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
    })
  }

  static async sample(
    depth: number,
  ): Promise<{ tree: UtxoTree; db: DB }> {
    const utxoTreeMetadata = {
      id: v4(),
      index: 1,
      species: TreeSpecies.UTXO,
      start: Fp.from(0),
      end: Fp.from(0),
    }
    const utxoTreeConfig: TreeConfig<Fp> = {
      hasher: poseidonHasher(depth),
      forceUpdate: true,
      fullSync: true,
    }
    const preHashes = poseidonHasher(depth).preHash
    const utxoTreeInitialData = {
      root: genesisRoot(poseidonHasher(depth)),
      index: Fp.zero,
      siblings: preHashes.slice(0, -1),
    }
    const mockupDB = await SQLiteConnector.create(':memory:')
    await mockupDB.createTables(schema as any)
    const utxoTree = new UtxoTree({
      db: mockupDB,
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
