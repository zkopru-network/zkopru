/* eslint-disable @typescript-eslint/camelcase */
import chalk from 'chalk'
import fs from 'fs'
import Web3 from 'web3'
import { L1Contract } from '@zkopru/core'
import { DB } from '@zkopru/prisma'
import path from 'path'
import Configurator, { Context, Menu } from '../configurator'

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
  const config = await db.read(prisma =>
    prisma.config.findOne({
      where: {
        networkId_chainId_address: {
          networkId,
          address,
          chainId,
        },
      },
    }),
  )
  if (!config) {
    const layer1: L1Contract = new L1Contract(web3, address)
    const configFromContract = await layer1.getConfig()
    await db.write(prisma =>
      prisma.config.create({
        data: configFromContract,
      }),
    )
  }
}

export default class LoadDatabase extends Configurator {
  static code = Menu.LOAD_DATABASE

  async run(context: Context): Promise<{ context: Context; next: number }> {
    console.log(chalk.blue('Loading database'))
    if (!context.web3) {
      throw Error(chalk.red('Web3 does not exist'))
    }
    let database: DB
    if (this.base.postgres) {
      database = new DB({
        datasources: {
          postgres: { url: this.base.postgres },
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
        database = new DB({
          datasources: { sqlite: { url: `file:${dbPath}` } },
        })
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
            title: 'Postgres(work in progress)',
            value: DBType.POSTGRES,
          },
          {
            title: 'Sqlite',
            value: DBType.SQLITE,
          },
        ],
        initial: DBType.SQLITE,
      })

      if (dbType === DBType.POSTGRES) {
        console.log(chalk.blue('Creating a postgresql connection'))
        console.log(chalk.yellow('Fetch schema files'))
        console.log(chalk.yellow('1. Install postgres.'))
        console.log(chalk.yellow('2. Run postgres daemon.'))
        console.log(chalk.yellow('3. set up database'))
        console.log(chalk.yellow('4. provide db connection info'))
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
          initial: 'zkopru-coordinator',
        })
        database = new DB({
          datasources: {
            postgres: {
              url: `postgresql://${user}:${password}@${host}:${port}/${dbName}`,
            },
          },
        })
      } else {
        console.log(chalk.blue('Creating a sqlite3 connection'))
        console.log(chalk.yellow('Provide file path to store sqlite db'))
        console.log(chalk.yellow('ex: ./zkopru.db'))
        const { dbName } = await this.ask({
          type: 'text',
          name: 'dbName',
          message: 'Provide sqlite db here',
          initial: 'zkopru-coordinator.db',
        })
        if (!fs.existsSync(dbName)) {
          const { db } = await DB.mockup(dbName)
          database = db
        } else {
          const { overwrite } = await this.ask({
            type: 'confirm',
            name: 'overwrite',
            message: `DB already exists. Do you want to overwrite? ${chalk.yellow(
              'WARN: you may lose your assets if you overwrite the database.',
            )}`,
            initial: false,
          })
          if (overwrite) {
            const { db } = await DB.mockup(dbName)
            database = db
          } else {
            const dbPath = path.join(path.resolve('.'), dbName)
            database = new DB({
              datasources: { sqlite: { url: `sqlite://${dbPath}` } },
            })
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
      context: { ...context, db: database },
      next: Menu.LOAD_COORDINATOR,
    }
  }
}
