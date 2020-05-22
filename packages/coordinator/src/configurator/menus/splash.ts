import chalk from 'chalk'
import figlet from 'figlet'
import Configurator, { Context, Menu } from '../configurator'

const { print, goTo } = Configurator

export default class Splash extends Configurator {
  static code = Menu.SPLASH

  // eslint-disable-next-line class-methods-use-this
  async run(context: Context): Promise<Context> {
    print(chalk.cyan)(figlet.textSync('ZK', 'Isometric3'))
    print(chalk.cyan)(figlet.textSync('OPRU', 'Isometric3'))
    print(chalk.cyan)('\n ==============================================')
    print(chalk.cyan)(figlet.textSync('coordinator', 'Small'))
    return goTo(context, Menu.CONNECT_WEB3)
  }
}
