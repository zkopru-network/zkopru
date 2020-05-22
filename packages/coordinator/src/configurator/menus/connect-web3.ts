import chalk from 'chalk'
import Web3 from 'web3'
import Configurator, { Context, Menu } from '../configurator'

const { print, goTo } = Configurator

export default class ConnectWeb3 extends Configurator {
  static code = Menu.CONNECT_WEB3

  async run(context: Context): Promise<Context> {
    print(chalk.blue)('Connecting to the Ethereum network')
    const provider = new Web3.providers.WebsocketProvider(
      this.config.websocket,
      {
        reconnect: { auto: true },
      },
    )
    const web3 = new Web3(provider)
    async function waitConnection() {
      return new Promise<void>(res => {
        if (provider.connected) res()
        provider.on('connect', res)
      })
    }
    provider.connect()
    await waitConnection()
    print(chalk.blue)(`Connected via ${this.config.websocket}`)
    return { ...goTo(context, Menu.CONFIG_ACCOUNT), web3, provider }
  }
}
