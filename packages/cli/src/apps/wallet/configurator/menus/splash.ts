import chalk from 'chalk'
import figlet from 'figlet'
import Configurator, { Context, Menu } from '../configurator'

export default class Splash extends Configurator {
  static code = Menu.SPLASH

  // eslint-disable-next-line class-methods-use-this
  async run(context: Context): Promise<{ context: Context; next: number }> {
    this.print(`${chalk.cyan(figlet.textSync('ZK', 'Isometric3'))}
${chalk.cyan(figlet.textSync('OPRU', 'Isometric3'))}
${chalk.cyan('\n =========================')}
${chalk.cyan(figlet.textSync('wallet', 'Small'))}`)
    return {
      next: Menu.CONNECT_WEB3,
      context,
    }
  }
}
