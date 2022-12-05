import { Provider } from '@ethersproject/providers'
import schema from './schema'
import { DB } from './types'
import { Config } from './schema.types'

interface L1Contract {
  getConfig(): Promise<Config>
}

export async function initDB(
  db: DB,
  provider: Provider,
  address: string,
  layer1: L1Contract,
) {
  const network = await provider.getNetwork()
  const [networkId, chainId] = [network.chainId, network.chainId]
  const config = await db.findOne('Config', {
    where: {
      networkId,
      address,
      chainId,
    },
  })
  if (!config) {
    const configFromContract = await layer1.getConfig()
    await db.create('Config', configFromContract)
  }
}

export enum TreeSpecies {
  UTXO = 0,
  WITHDRAWAL = 1,
}

export const NULLIFIER_TREE_ID = 'nullifier-tree'

export * from './types'
export * from './schema.types'
export * from './block-cache'
export * from './helpers/memory'
export { schema }
