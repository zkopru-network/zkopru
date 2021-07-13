import chalk from 'chalk'
import { PromptApp } from '@zkopru/utils'
import Web3 from 'web3'
import { Menu, ExampleConfigContext } from '../menu'

const addressesByNetworkId = {
  '1': undefined,
  '5': '0xfD1788744a618bDCFA241BD0Ff346d15d8Cf5501',
}

export default class Wallet extends PromptApp<ExampleConfigContext, void> {
  static code = Menu.SET_WEBSOCKET

  async run(
    context: ExampleConfigContext,
  ): Promise<{ context: ExampleConfigContext; next: number }> {
    console.log(chalk.blue('Geth Websocket'))
    let websocket = ''
    let { address } = context.config
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
        // eslint-disable-next-line no-continue
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
    return {
      context: {
        config: {
          ...context.config,
          address,
          websocket,
        },
        outputPath: context.outputPath,
      },
      next: Menu.SET_DB,
    }
  }
}
