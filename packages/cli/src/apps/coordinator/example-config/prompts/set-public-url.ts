import chalk from 'chalk'
import { PromptApp, validatePublicUrls } from '@zkopru/utils'
import { Config } from '../../configurator/configurator'
import { Menu, ExampleConfigContext } from '../menu'

export default class Wallet extends PromptApp<ExampleConfigContext, Config> {
  static code = Menu.SET_PUBLIC_URLS

  async run(
    context: ExampleConfigContext,
  ): Promise<{ context: ExampleConfigContext; next: number }> {
    console.log(chalk.blue('Public URLs'))
    console.log(
      `Your detected public urls are: ${chalk.bold(
        context.config.publicUrls || '',
      )}`,
    )
    const { update } = await this.ask({
      type: 'confirm',
      name: 'update',
      message: `Would you like to update your public urls?`,
      initial: false,
    })
    if (!update) return { context, next: Menu.SET_WEBSOCKET }
    let publicUrls: string | undefined
    do {
      const { urls } = await this.ask({
        type: 'text',
        name: 'urls',
        initial: context.config.publicUrls,
        message: 'Enter new host:port entries separated by commas',
      })
      try {
        validatePublicUrls(urls)
        publicUrls = urls
      } catch (err) {
        console.log(chalk.red(err.message))
      }
    } while (!publicUrls)
    return {
      context: {
        config: {
          ...context.config,
          publicUrls,
        },
        outputPath: context.outputPath,
      },
      next: Menu.SET_WEBSOCKET,
    }
  }
}
