import chalk from 'chalk'
import { sleep } from '@zkopru/utils'
import App, { AppMenu, Context } from '../app'

export default class OnSyncing extends App {
  static code = AppMenu.ON_SYNCING

  // eslint-disable-next-line class-methods-use-this
  async run(context: Context): Promise<{ context: Context; next: number }> {
    this.print(chalk.yellow('On syncing...'))
    await sleep(1000)
    return { context, next: AppMenu.TOP_MENU }
    // const { idx } = await this.ask({
    //   type: 'select',
    //   name: 'idx',
    //   message: 'Which account do you want to use?',
    //   choices: [
    //     {
    //       title: 'exit',
    //       value: 0,
    //     },
    //     {
    //       title: 'try again',
    //       value: 1,
    //     },
    //   ],
    // })
    // switch (idx) {
    //   case 0:
    //     return { ...goTo(context, AppMenu.EXIT) }
    //   default:
    //     return { ...goTo(context, AppMenu.TOP_MENU) }
    // }
  }
}
