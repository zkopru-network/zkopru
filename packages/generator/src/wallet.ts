/* eslint-disable no-case-declarations */
import path from 'path'
import { toWei } from 'web3-utils'

import { FullNode } from '@zkopru/core'
import { logger } from '@zkopru/utils'
import { TransferGenerator } from './generator'
import { getBase, startLogger } from './generator-utils'
import { config } from './config'

const accountIdx: number = parseInt(process.env.ID ?? '0')

startLogger(`./WALLET_${accountIdx}_LOG`)

async function runGenerator() {
  logger.info('Wallet Initializing')
  logger.info(`Wallet selected account index ${accountIdx + 3}`)

  const { hdWallet, mockupDB, webSocketProvider } = await getBase(
    config.testnetUrl,
    config.mnemonic,
    'helloworld',
  )

  const walletNode: FullNode = await FullNode.new({
    provider: webSocketProvider,
    address: config.zkopruContract, // Zkopru contract
    db: mockupDB,
    accounts: [],
  })

  // Assume that account index 0, 1, 2 are reserved
  // Account #0 - Coordinator
  // Account #1 - Slasher
  // Account #2 - None
  const walletAccount = await hdWallet.createAccount(3 + accountIdx)
  const transferGeneratorConfig = {
    hdWallet,
    db: mockupDB,
    account: walletAccount,
    node: walletNode,
    noteAmount: { eth: toWei('0.1'), fee: toWei('0.01') },
    erc20: [],
    erc721: [],
    snarkKeyPath: path.join(__dirname, '../../circuits/keys'),
  }

  const generator = new TransferGenerator(transferGeneratorConfig)
  logger.info(`Wallet node start`)

  logger.info(`Start Generate Tansaction`)
  await generator.startGenerator()

  // setTimeout(async () => {
  //   logger.info('Stop Generator')
  //   await generator.stopGenerator()
  // }, 100000)
}

runGenerator()
