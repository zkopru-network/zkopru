import chalk from 'chalk'
import App, { AppMenu, Context } from '.'

export default class AutoCoordinate extends App {
  static code = AppMenu.AUTO_COORDINATE

  async run(context: Context): Promise<{ context: Context; next: number }> {
    this.print(chalk.blue('Start auto coordination'))
    this.base.start()
    return { context, next: AppMenu.TOP_MENU }
  }
}
