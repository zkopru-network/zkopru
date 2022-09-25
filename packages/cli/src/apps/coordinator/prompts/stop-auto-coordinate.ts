import chalk from 'chalk'
import App, { AppMenu, Context } from '.'

export default class StopAutoCoordination extends App {
  static code = AppMenu.STOP_AUTO_COORDINATION

  async run(context: Context): Promise<{ context: Context; next: number }> {
    this.print(chalk.blue('Stop auto coordination'))
    await this.base.stop()
    return { context, next: AppMenu.TOP_MENU }
  }
}
