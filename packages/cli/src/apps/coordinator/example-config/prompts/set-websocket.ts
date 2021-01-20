import chalk from 'chalk'
import { PromptApp } from '@zkopru/utils'
import Web3 from 'web3'
import { Config } from '../../configurator/configurator'
import { Menu } from '../menu'

const addressesByNetworkId = {
  '1': undefined,
  '5': '0xF4A46BEA80d0D21a11306DDE6cb0fFA91fF95ADd',
}

export default class Wallet extends PromptApp<Config, Config> {
  static code = Menu.SET_WEBSOCKET

  async run(context: Config): Promise<{ context: Config; next: number }> {
    console.log(chalk.blue('Geth Websocket'))
    let websocket = ''
    let address = context.address
    do {
      const { websocketUrl } = await this.ask({
        type: 'text',
        name: 'websocketUrl',
        message: 'Enter an Ethereum websocket url',
      })
      if (
        websocketUrl.indexOf('ws') !== 0 &&
        websocketUrl.indexOf('wss') !== 0
      ) {
        console.log(chalk.red('Websocket url must start with ws:// or wss://'))
        continue
      }
      try {
        const web3 = new Web3(websocketUrl)
        const chainId = await web3.eth.getChainId()
        address = addressesByNetworkId[chainId.toString(10)]
        if (address) {
          websocket = websocketUrl
          break
        }
        const { confirm } = await this.ask({
          type: 'confirm',
          name: 'confirm',
          message: `Zkopru is not deployed on this network (${chainId}), continue?`,
        })
        if (confirm) {
          websocket = websocketUrl
          address = ''
          break
        }
      } catch (err) {
        console.log(chalk.red('Error connecting to Ethereum node'))
        console.log(err)
      }
    } while (!websocket)
    return { context: { ...context, address, websocket }, next: Menu.COMPLETE }
  }
}
