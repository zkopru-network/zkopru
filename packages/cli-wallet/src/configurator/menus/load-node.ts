import chalk from 'chalk'
import {
  FullNode,
  ZkOPRUNode,
  LightNode,
  HttpBootstrapHelper,
} from '@zkopru/core'
import Configurator, { Context, Menu } from '../configurator'

const { print, goTo } = Configurator

export default class LoadNode extends Configurator {
  static code = Menu.LOAD_NODE

  // eslint-disable-next-line class-methods-use-this
  async run(context: Context): Promise<Context> {
    if (!context.provider) throw Error('Websocket provider does not exist')
    if (!context.db) throw Error('Database does not exist')
    if (!context.accounts) throw Error('Wallet is not set')
    if (!context.provider.connected)
      throw Error('Websocket provider is not connected')
    let node: ZkOPRUNode
    const { provider, db, accounts } = context
    const { address, coordinator: bootstrap } = this.config
    if (this.config.fullnode) {
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
        option: {
          header: true,
          deposit: true,
          migration: true,
          outputRollUp: true,
          withdrawalRollUp: true,
          nullifierRollUp: false, // Only for FULL NODE
          snark: false,
        },
      })
      print(chalk.blue)(`Bootstrap light node from ${bootstrap}`)
      await node.bootstrap()
    }
    return { ...goTo(context, Menu.SAVE_CONFIG), node }
  }
}
