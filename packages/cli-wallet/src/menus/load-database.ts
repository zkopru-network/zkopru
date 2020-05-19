import chalk from 'chalk'
import fs from 'fs-extra'
import Web3 from 'web3'
import { LevelDB } from '@nano-sql/adapter-leveldb'
import { InanoSQLInstance, nSQL } from '@nano-sql/core'
import { schema, ChainConfig } from '@zkopru/database'
import { InanoSQLAdapter } from '@nano-sql/core/lib/interfaces'
import { L1Contract } from '@zkopru/core'
import App, { Context, Menu } from '../app'

const { print, goTo } = App

async function initDB({
  name,
  dbAdapter,
  web3,
  address,
}: {
  name: string
  dbAdapter: string | InanoSQLAdapter
  web3: Web3
  address: string
}): Promise<{
  db: InanoSQLInstance
  zkopruId: string
}> {
  await nSQL().createDatabase({
    id: name,
    mode: dbAdapter,
    tables: [
      schema.chain,
      schema.hdWallet,
      schema.keystore,
      schema.block,
      schema.deposit,
      schema.massDeposit,
      schema.utxo,
      schema.withdrawal,
      schema.migration,
      schema.utxoTree,
      schema.withdrawalTree,
      schema.nullifiers,
      schema.nullifierTreeNode,
    ],
  })
  const db = nSQL().useDatabase(name)
  const networkId = await web3.eth.net.getId()
  const chainId = await web3.eth.getChainId()
  const queryResult = await db
    .selectTable(schema.chain.name)
    .presetQuery('read', {
      networkId,
      chainId,
      address,
    })
    .exec()
  let zkopruId: string
  if (queryResult.length === 0) {
    const layer1: L1Contract = new L1Contract(web3, address)
    const config = await layer1.getConfig()
    console.log('retrieved config', config)
    const createResult = (await db
      .selectTable(schema.chain.name)
      .presetQuery('create', {
        networkId,
        chainId,
        address,
        config,
      })
      .exec()) as ChainConfig[]
    zkopruId = createResult[0].id
    console.log('create result', createResult[0])
  } else {
    console.log('query result', queryResult[0])
    zkopruId = queryResult[0].id
  }
  return {
    db,
    zkopruId,
  }
}

export default class LoadDatabase extends App {
  async run(context: Context): Promise<Context> {
    print(chalk.blue)('Loading database')
    if (!context.web3) {
      throw Error(chalk.red('Web3 does not exist'))
    }
    fs.mkdirpSync(this.config.db)
    // const dbAdapter = 'PERM'
    const dbAdapter = new LevelDB(this.config.db)
    const { zkopruId, db } = await initDB({
      name: `zkopru-cli-wallet-${this.config.fullnode ? 'full' : 'light'}-node`,
      dbAdapter,
      web3: context.web3,
      address: this.config.address,
    })
    print(chalk.blue)(`Loaded LevelDB from ${this.config.db}`)
    return { ...goTo(context, Menu.LOAD_HDWALLET), db, zkopruId }
  }
}
