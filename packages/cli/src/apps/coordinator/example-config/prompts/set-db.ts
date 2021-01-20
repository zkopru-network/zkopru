import chalk from 'chalk'
import { PromptApp, makePathAbsolute } from '@zkopru/utils'
import { Menu, ExampleConfigContext } from '../menu'

export default class SetDB extends PromptApp<ExampleConfigContext, void> {
  static code = Menu.SET_DB

  async run(
    context: ExampleConfigContext,
  ): Promise<{ context: ExampleConfigContext; next: number }> {
    console.log(chalk.blue(`Database`))
    const enum DBType {
      SQLITE,
      POSTGRES,
    }
    const { dbType } = await this.ask({
      type: 'select',
      name: 'dbType',
      message: `Which database would you like to use?`,
      initial: DBType.SQLITE,
      choices: [
        {
          title: 'SQLite',
          value: DBType.SQLITE,
        },
        {
          title: 'PostgreSQL',
          value: DBType.POSTGRES,
        },
      ],
    })
    const db = {}
    if (dbType === DBType.SQLITE) {
      const { sqlite } = await this.ask({
        type: 'text',
        name: 'sqlite',
        message: 'Where should the database be stored?',
        initial: './database.sqlite',
      })
      Object.assign(db, { sqlite: makePathAbsolute(sqlite) })
    } else {
      const { postgres } = await this.ask({
        type: 'text',
        name: 'postgres',
        message: 'Enter your postgres url',
      })
      Object.assign(db, { postgres })
    }
    return {
      context: {
        config: {
          ...context.config,
          ...db,
        },
        outputPath: context.outputPath,
      },
      next: Menu.OUTPUT_PATH,
    }
  }
}
