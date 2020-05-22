import chalk from 'chalk'
import App, { AppMenu, Context } from '../app'

const { goTo, print } = App

export default class AutoCoordinate extends App {
  static code = AppMenu.AUTO_COORDINATE

  async run(context: Context): Promise<Context> {
    print(chalk.blue)('Start auto coordination')
    this.coordinator.start()
    return {
      ...goTo(context, AppMenu.TOP_MENU),
    }
  }
}
