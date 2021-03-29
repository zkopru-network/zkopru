import {
  DB,
  SQLiteMemoryConnector,
  TreeSpecies,
  schema,
} from '@zkopru/database/dist/node'
import { Fp } from '@zkopru/babyjubjub'
import { v4 } from 'uuid'
import { TreeConfig } from './light-rollup-tree'
import { UtxoTree } from './utxo-tree'
import { genesisRoot, poseidonHasher } from './hasher'

export default async function sample(
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
  const mockupDB = await SQLiteMemoryConnector.create(schema)
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
