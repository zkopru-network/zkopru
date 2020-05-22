import chalk from 'chalk'
import App, { AppMenu, Context } from '../../app'

const { goTo, print } = App

export default class CompleteSetup extends App {
  static code = AppMenu.COMPLETE_SETUP

  // eslint-disable-next-line class-methods-use-this
  async run(context: Context): Promise<Context> {
    print(chalk.blue)('Sending setup complete request')
    const receipt = await this.coordinator.completeSetup()
    print(chalk.blue)('Receipt', receipt)
    return {
      ...goTo(context, AppMenu.SETUP_MENU),
    }
  }
}
