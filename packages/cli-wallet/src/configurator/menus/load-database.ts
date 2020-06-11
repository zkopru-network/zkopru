/* eslint-disable @typescript-eslint/camelcase */
import chalk from 'chalk'
import fs from 'fs-extra'
import Web3 from 'web3'
import { L1Contract } from '@zkopru/core'
import { DB } from '@zkopru/prisma'
import path from 'path'
import Configurator, { Context, Menu } from '../configurator'

// TODO refactoring - reused code with coordinator/src/configurator/menus/load-database.ts
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

  async run(context: Context): Promise<{ context: Context; next: number }> {
    this.print(chalk.blue('Loading database'))
    if (!context.web3) {
      throw Error(chalk.red('Web3 does not exist'))
    }
    let database: DB
    if (this.base.postgres) {
      database = new DB({
        datasources: {
          postgres: this.base.postgres,
        },
      })
    } else if (this.base.sqlite) {
      const dbPath = this.base.sqlite
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
        this.print(`chalk.blue('Creating a postgresql connection')
        ${chalk.yellow('Fetch schema files')}
        ${chalk.yellow('1. Install postgres.')}
        ${chalk.yellow('2. Run postgres daemon.')}
        ${chalk.yellow('3. set up database')}
        ${chalk.yellow('4. provide db connection info')}`)
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
        this.print(`${chalk.blue('Creating a sqlite3 connection')}
        ${chalk.yellow('Provide file path to store sqlite db')}
        ${chalk.yellow('ex: ./zkopru.db')}`)
        const { dbName } = await this.ask({
          type: 'text',
          name: 'dbName',
          message: 'Provide sqlite db here',
          initial: 'zkopru.db',
        })
        if (!fs.existsSync(dbName)) {
          const { db } = await DB.mockup(dbName)
          database = db
        } else {
          const { overwrite } = await this.ask({
            type: 'confirm',
            name: 'overwrite',
            message: 'DB already exists. Do you want to overwrite?',
            initial: true,
          })
          if (overwrite) {
            const { db } = await DB.mockup(dbName)
            database = db
          } else {
            const dbPath = path.join(path.resolve('.'), dbName)
            database = new DB({ datasources: { sqlite: `file://${dbPath}` } })
          }
        }
      }
    }
    await initDB({
      db: database,
      web3: context.web3,
      address: this.base.address,
    })
    return {
      context: {
        ...context,
        db: database,
      },
      next: Menu.LOAD_HDWALLET,
    }
  }
}
