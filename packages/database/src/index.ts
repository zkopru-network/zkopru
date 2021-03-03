export { SQLiteConnector } from './connectors/sqlite'
export { DB, TableData } from './types'
export * from './schema.types'
import schema from './schema'
export { schema }

import { DB } from './types'
import { Config } from './schema.types'
import Web3 from 'web3'

interface L1Contract {
  getConfig(): Promise<Config>
}

export async function initDB(db: DB, web3: Web3, address: string, layer1: L1Contract) {
  const [networkId, chainId] = await Promise.all([
    web3.eth.net.getId(),
    web3.eth.getChainId(),
  ])
  const config = await db.findOne('Config', {
    where: {
      networkId,
      address,
      chainId,
    }
  })
  if (!config) {
    const configFromContract = await layer1.getConfig()
    await db.create('Config', configFromContract)
  }
}
