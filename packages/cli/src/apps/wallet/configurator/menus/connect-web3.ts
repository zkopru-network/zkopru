import chalk from 'chalk'
import { WebSocketProvider, JsonRpcProvider } from '@ethersproject/providers'
import Configurator, { Context, Menu } from '../configurator'

export default class ConnectWeb3 extends Configurator {
  static code = Menu.CONNECT_WEB3

  async run(context: Context): Promise<{ context: Context; next: number }> {
    this.print(chalk.blue('Connecting to the Ethereum network'))

    const provider:
      | WebSocketProvider
      | JsonRpcProvider = this.base.provider.startsWith('ws')
      ? new WebSocketProvider(this.base.provider)
      : new JsonRpcProvider(this.base.provider)
    async function waitConnection() {
      return new Promise<void>(async res => {
        if (await provider.ready) return res()
        provider.on('connect', res)
      })
    }
    await waitConnection()
    this.print(chalk.blue(`Connected via ${this.base.provider}`))
    return {
      context: {
        ...context,
        provider,
      },
      next: Menu.DOWNLOAD_KEYS,
    }
  }
}
