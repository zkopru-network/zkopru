import chalk from 'chalk'
import Web3 from 'web3'
import Configurator, { Context, Menu } from '../configurator'

export default class ConnectWeb3 extends Configurator {
  static code = Menu.CONNECT_WEB3

  async run(context: Context): Promise<{ context: Context; next: number }> {
    this.print(chalk.blue('Connecting to the Ethereum network'))
    const provider = new Web3.providers.WebsocketProvider(this.base.websocket, {
      reconnect: { auto: true },
    })
    const web3 = new Web3(provider)
    async function waitConnection() {
      return new Promise<void>(res => {
        if (provider.connected) res()
        provider.on('connect', res)
      })
    }
    await waitConnection()
    this.print(chalk.blue(`Connected via ${this.base.websocket}`))
    return {
      context: {
        ...context,
        web3,
        provider,
      },
      next: Menu.DOWNLOAD_KEYS,
    }
  }
}
