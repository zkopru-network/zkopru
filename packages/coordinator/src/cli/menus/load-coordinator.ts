import { FullNode } from '@zkopru/core'
import App, { Context, Menu } from '../app'
import { Coordinator } from '../../coordinator'

const { goTo } = App

export default class LoadCoordinator extends App {
  // eslint-disable-next-line class-methods-use-this
  async run(context: Context): Promise<Context> {
    if (!context.provider) throw Error('Websocket provider does not exist')
    if (!context.db) throw Error('Database does not exist')
    if (!context.provider.connected)
      throw Error('Websocket provider is not connected')

    const { address, maxBytes, bootstrap, priceMultiplier, port } = this.config
    const { provider, db } = context
    const fullNode: FullNode = await FullNode.new({
      address,
      provider,
      db,
    })
    const coordinator = new Coordinator(fullNode, {
      maxBytes,
      bootstrap,
      priceMultiplier, // 32 gas is the current default price for 1 byte
      port,
    })
    return { ...goTo(context, Menu.COMPLETE_SETUP), coordinator }
  }
}
