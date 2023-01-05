import chalk from 'chalk'
import App, { AppMenu, Context } from '.'
import { logger } from '@zkopru/utils'

export default class AutoCoordinate extends App {
  static code = AppMenu.AUTO_COORDINATE

  async run(context: Context): Promise<{ context: Context; next: number }> {
    this.print(chalk.blue('Start auto coordination'))
    try {
      await this.base.start()
    } catch (err) {
      logger.error(err as any)
    }
    return { context, next: AppMenu.TOP_MENU }
  }
}
