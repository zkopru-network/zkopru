import chalk from 'chalk'
import { ethers } from 'ethers'
import Web3WsProvider from 'web3-providers-ws'
import Configurator, { Context, Menu } from '../configurator'

export default class ConnectWeb3 extends Configurator {
  static code = Menu.CONNECT_WEB3

  async run(context: Context): Promise<{ context: Context; next: number }> {
    console.log(chalk.blue('Connecting to the Ethereum network'))
    const provider = new ethers.providers.Web3Provider(
      new (Web3WsProvider as any)(this.base.provider, {
        reconnect: {
          delay: 2000,
          auto: true,
          onTimeout: false
        },
        clientConfig: {
          keepalive: true,
          keepaliveInterval: 30000,
        },
      }))
    async function waitConnection() {
      return new Promise<void>(async res => {
        if (await provider.ready) return res()
        provider.on('connect', res)
      })
    }
    await waitConnection()
    console.log(chalk.blue(`Connected via ${this.base.provider}`))
    return {
      context: { ...context, provider },
      next: Menu.CONFIG_ACCOUNT,
    }
  }
}
