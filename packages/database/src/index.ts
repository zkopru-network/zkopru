import Web3 from 'web3'

import schema from './schema'
import { DB } from './types'
import { Config } from './schema.types'

interface L1Contract {
  getConfig(): Promise<Config>
}

export async function initDB(
  db: DB,
  web3: Web3,
  address: string,
  layer1: L1Contract,
) {
  const [networkId, chainId] = await Promise.all([
    web3.eth.net.getId(),
    web3.eth.getChainId(),
  ])
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
export * from './preset'
export * from './block-cache'
export * from './helpers/memory'
export { schema }
