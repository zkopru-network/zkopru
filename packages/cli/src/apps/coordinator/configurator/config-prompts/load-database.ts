import chalk from 'chalk'
import fs from 'fs'
import {
  DB,
  SQLiteConnector,
  PostgresConnector,
  schema,
  initDB,
} from '@zkopru/database/dist/node'
import { L1Contract } from '@zkopru/core'
import Configurator, { Context, Menu } from '../configurator'

export default class LoadDatabase extends Configurator {
  static code = Menu.LOAD_DATABASE

  async run(context: Context): Promise<{ context: Context; next: number }> {
    console.log(chalk.blue('Loading database'))
    if (!context.web3) {
      throw Error(chalk.red('Web3 does not exist'))
    }
    let database: DB
    if (this.base.postgres) {
      database = await PostgresConnector.create(schema, this.base.postgres)
    } else if (this.base.sqlite) {
      const dbPath = this.base.sqlite
      database = await SQLiteConnector.create(schema, dbPath)
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
        database = await PostgresConnector.create(
          schema,
          `postgresql://${user}:${password}@${host}:${port}/${dbName}`,
        )
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
        if (fs.existsSync(dbName)) {
          const { overwrite } = await this.ask({
            type: 'confirm',
            name: 'overwrite',
            message: `DB already exists. Do you want to overwrite? ${chalk.yellow(
              'WARN: you may lose your assets if you overwrite the database.',
            )}`,
            initial: false,
          })
          if (overwrite) {
            fs.unlinkSync(dbName)
          }
        }
        database = await SQLiteConnector.create(schema, dbName)
      }
    }
    await initDB(
      database,
      context.web3,
      this.base.address,
      new L1Contract(context.web3, this.base.address),
    )
    return {
      context: {
        ...context,
        db: database,
      },
      next: Menu.LOAD_COORDINATOR,
    }
  }
}
