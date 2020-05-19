import chalk from 'chalk'
import Web3 from 'web3'
import App, { Context, Menu } from '../app'

const { print, goTo } = App

export default class ConnectWeb3 extends App {
  async run(context: Context): Promise<Context> {
    print(chalk.blue)('Connecting to the Ethereum network')
    const provider = new Web3.providers.WebsocketProvider(this.config.websocket, {
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
    print(chalk.blue)(`Connected via ${this.config.websocket}`)
    return { ...goTo(context, Menu.DOWNLOAD_KEYS), web3, provider }
  }
}
