import chalk from 'chalk'
import figlet from 'figlet'
import App, { Context, Menu } from '../app'

const { print, goTo } = App

export default class Splash extends App {
  // eslint-disable-next-line class-methods-use-this
  async run(context: Context): Promise<Context> {
    print(chalk.cyan)(figlet.textSync('ZKOPRU', 'Isometric3'))
    return goTo(context, Menu.CONNECT_WEB3)
  }
}
