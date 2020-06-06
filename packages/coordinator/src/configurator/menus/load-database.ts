/* eslint-disable @typescript-eslint/camelcase */
import chalk from 'chalk'
import fs from 'fs'
import Web3 from 'web3'
import { L1Contract } from '@zkopru/core'
import { DB } from '@zkopru/prisma'
import Configurator, { Context, Menu } from '../configurator'

const { print, goTo } = Configurator

async function initDB({
  db,
  web3,
  address,
}: {
  db: DB
  web3: Web3
  address: string
}) {
  const networkId = await web3.eth.net.getId()
  const chainId = await web3.eth.getChainId()
  const config = await db.prisma.config.findOne({
    where: {
      networkId_chainId_address: {
        networkId,
        address,
        chainId,
      },
    },
  })
  if (!config) {
    const layer1: L1Contract = new L1Contract(web3, address)
    const configFromContract = await layer1.getConfig()
    await db.prisma.config.create({
      data: configFromContract,
    })
  }
}

export default class LoadDatabase extends Configurator {
  static code = Menu.LOAD_DATABASE

  async run(context: Context): Promise<Context> {
    print(chalk.blue)('Loading database')
    if (!context.web3) {
      throw Error(chalk.red('Web3 does not exist'))
    }
    let database: DB
    if (this.config.postgres) {
      database = new DB({
        datasources: {
          postgres: this.config.postgres,
        },
      })
    } else if (this.config.sqlite) {
      const dbPath = this.config.sqlite
      if (!fs.existsSync(dbPath)) {
        // create new dataabase
        const { db } = await DB.mockup(dbPath)
        database = db
      } else {
        // database exists
        database = new DB({ datasources: { sqlite: dbPath } })
      }
    } else {
      // no configuration. try to create new one
      const enum DBType {
        POSTGRES,
        SQLITE,
      }
      const { dbType } = await this.ask({
        type: 'select',
        name: 'dbType',
        message: 'You should configure database',
        choices: [
          {
            title: 'Postgres(recommended)',
            value: DBType.POSTGRES,
          },
          {
            title: 'Sqlite',
            value: DBType.SQLITE,
          },
        ],
      })

      if (dbType === DBType.POSTGRES) {
        print(chalk.blue)('Creating a postgresql connection')
        print(chalk.yellow)('Fetch schema files')
        print(chalk.yellow)('1. Install postgres.')
        print(chalk.yellow)('2. Run postgres daemon.')
        print(chalk.yellow)('3. set up database')
        print(chalk.yellow)('4. provide db connection info')
        // TODO provide migrate option later
        // TODO provide detail database setup guide
        const { host } = await this.ask({
          type: 'text',
          name: 'host',
          message: 'Host? ex: localhost',
        })
        const { port } = await this.ask({
          type: 'number',
          name: 'port',
          message: 'Port number?',
          initial: 5432,
        })
        const { user } = await this.ask({
          type: 'text',
          name: 'user',
          message: 'Username',
        })
        const { password } = await this.ask({
          type: 'password',
          name: 'password',
          message: 'Password',
        })
        const { dbName } = await this.ask({
          type: 'text',
          name: 'dbName',
          message: 'DB Name',
          initial: 'zkopru',
        })
        database = new DB({
          datasources: {
            postgres: `postgresql://${user}:${password}@${host}:${port}/${dbName}`,
          },
        })
      } else {
        print(chalk.blue)('Creating a sqlite3 connection')
        print(chalk.yellow)('Provide file path to store sqlite db')
        print(chalk.yellow)('ex: ./zkopru.db')
        const { dbName } = await this.ask({
          type: 'text',
          name: 'dbName',
          message: 'Provide sqlite db here',
        })
        const { db } = await DB.mockup(dbName)
        database = db
      }
    }
    await initDB({
      db: database,
      web3: context.web3,
      address: this.config.address,
    })
    return { ...goTo(context, Menu.LOAD_COORDINATOR), db: database }
  }
}
