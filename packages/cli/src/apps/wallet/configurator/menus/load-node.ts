import chalk from 'chalk'
import {
  FullNode,
  ZkopruNode,
  LightNode,
  HttpBootstrapHelper,
} from '@zkopru/core'
import Configurator, { Context, Menu } from '../configurator'

export default class LoadNode extends Configurator {
  static code = Menu.LOAD_NODE

  // eslint-disable-next-line class-methods-use-this
  async run(context: Context): Promise<{ context: Context; next: number }> {
    if (!context.provider) throw Error('Websocket provider does not exist')
    if (!context.db) throw Error('Database does not exist')
    if (!context.accounts) throw Error('Wallet is not set')
    if (!context.provider.connected)
      throw Error('Websocket provider is not connected')
    let node: ZkopruNode
    const { provider, db, accounts } = context
    const { address, coordinator: bootstrap } = this.base
    if (this.base.fullnode) {
      node = await FullNode.new({
        provider,
        address,
        db,
        accounts,
      })
    } else {
      node = await LightNode.new({
        provider,
        address,
        db,
        accounts,
        bootstrapHelper: new HttpBootstrapHelper(bootstrap),
      })
      this.print(chalk.blue(`Bootstrap light node from ${bootstrap}`))
      await (node as LightNode).bootstrap()
    }
    return {
      context: { ...context, node },
      next: Menu.SAVE_CONFIG,
    }
  }
}
