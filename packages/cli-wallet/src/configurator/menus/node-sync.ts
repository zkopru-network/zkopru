import chalk from 'chalk'
import { NetworkStatus } from '@zkopru/core'
import Configurator, { Context, Menu } from '../configurator'

const { print, goTo } = Configurator

export default class NodeSync extends Configurator {
  static code = Menu.NODE_SYNC

  // eslint-disable-next-line class-methods-use-this
  async run(context: Context): Promise<Context> {
    const { node } = context
    if (!node) throw Error('ZKOPRU node is not defined')
    print(chalk.blue)('Synchronizing... ')
    return new Promise<Context>((res, rej) => {
      node.synchronizer.on('status', (status: NetworkStatus) => {
        switch (status) {
          case NetworkStatus.INITIALIZING:
            print(chalk.yellow)('Initializaing zkopru network')
            break
          case NetworkStatus.LIVE:
            print(chalk.green)('ZKOPRU network is on live')
            res(goTo(context, Menu.SAVE_CONFIG))
            break
          case NetworkStatus.ON_SYNCING:
            print(chalk.blue)('Synchronizing ZKOPRU network')
            break
          case NetworkStatus.FULLY_SYNCED:
            print(chalk.green)('Synchronizing is fully synced')
            break
          case NetworkStatus.ON_ERROR:
            print(chalk.red)('Error occured during synchronization')
            rej(Error('ZKOPRU synchronization error'))
            break
          default:
            print(chalk.red)('Network sync stopped')
            rej(Error('Network synchronization is stopped'))
            break
        }
      })
      node.startSync()
    })
  }
}
