import chalk from 'chalk'
import App, { AppMenu, Context } from '.'
import { logger } from '@zkopru/utils'

export default class StopAutoCoordination extends App {
  static code = AppMenu.STOP_AUTO_COORDINATION

  async run(context: Context): Promise<{ context: Context; next: number }> {
    this.print(chalk.blue('Stop auto coordination'))
    try {
      await this.base.stop()
    } catch (err) {
      logger.error(err as any)
    }
    return { context, next: AppMenu.TOP_MENU }
  }
}
