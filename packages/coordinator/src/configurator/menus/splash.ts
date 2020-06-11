import chalk from 'chalk'
import figlet from 'figlet'
import Configurator, { Context, Menu } from '../configurator'

export default class Splash extends Configurator {
  static code = Menu.SPLASH

  // eslint-disable-next-line class-methods-use-this
  async run(context: Context): Promise<{ context: Context; next: number }> {
    console.log(chalk.cyan(figlet.textSync('ZK', 'Isometric3')))
    console.log(chalk.cyan(figlet.textSync('OPRU', 'Isometric3')))
    console.log(chalk.cyan('\n =============================================='))
    console.log(chalk.cyan(figlet.textSync('coordinator', 'Small')))
    return { context, next: Menu.CONNECT_WEB3 }
  }
}
