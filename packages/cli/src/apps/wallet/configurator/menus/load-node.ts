import chalk from 'chalk'
import {
  FullNode,
  ZkopruNode,
  LightNode,
  HttpBootstrapHelper,
  CoordinatorManager,
} from '@zkopru/core'
import Configurator, { Context, Menu } from '../configurator'

export default class LoadNode extends Configurator {
  static code = Menu.LOAD_NODE

  // eslint-disable-next-line class-methods-use-this
  async run(context: Context): Promise<{ context: Context; next: number }> {
    if (!context.provider) throw Error('Websocket provider does not exist')
    if (!context.db) throw Error('Database does not exist')
    if (!context.accounts) throw Error('Wallet is not set')
    if (!(await context.provider.ready))
      throw Error('Websocket provider is not connected')
    let node: ZkopruNode
    const { provider, db, accounts } = context
    const { address } = this.base
    if (this.base.fullnode) {
      node = await FullNode.new({
        provider,
        address,
        db,
        accounts,
      })
    } else {
      const manager = new CoordinatorManager(address, provider)
      const coordinator = await manager.activeCoordinatorUrl()
      if (!coordinator) {
        this.print(`Unable to find coordinator to sync from`)
        process.exit(1)
      }
      node = await LightNode.new({
        provider,
        address,
        db,
        accounts,
        bootstrapHelper: new HttpBootstrapHelper(coordinator),
      })
      this.print(chalk.blue(`Bootstrap light node from ${coordinator}`))
      await (node as LightNode).bootstrap()
    }
    return {
      context: { ...context, node },
      next: Menu.SAVE_CONFIG,
    }
  }
}
