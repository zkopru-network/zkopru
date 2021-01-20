import chalk from 'chalk'
import { PromptApp } from '@zkopru/utils'
import { Config } from '../../configurator/configurator'
import { Menu } from '../menu'

export default class Wallet extends PromptApp<Config, Config> {
  static code = Menu.SET_PUBLIC_URLS

  async run(context: Config): Promise<{ context: Config; next: number }> {
    console.log(chalk.blue('Public URLs'))
    console.log(
      `Your detected public urls are: ${chalk.bold(context.publicUrls || '')}`,
    )
    const { update } = await this.ask({
      type: 'confirm',
      name: 'update',
      message: `Would you like to update your public urls?`,
      initial: false,
    })
    if (!update) return { context, next: Menu.COMPLETE }
    const { urls } = await this.ask({
      type: 'text',
      name: 'urls',
      initial: context.publicUrls,
      message: 'Enter new host:port entries separated by commas',
    })
    // TODO: validate entry
    return { context: { ...context, publicUrls: urls }, next: Menu.COMPLETE }
  }
}
