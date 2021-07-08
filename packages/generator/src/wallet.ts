/* eslint-disable no-case-declarations */
import { toWei } from 'web3-utils'
import fetch from 'node-fetch'

import { FullNode } from '@zkopru/core'
import { logger, sleep } from '@zkopru/utils'
import { TransferGenerator } from './generator'
import { getBase, startLogger } from './generator-utils'
import { config } from './config'

startLogger(`./WALLET_LOG`)

const redisIp = process.env.REDIS_IP ?? `redis`
const organizerUrl = process.env.ORGANIZER_URL ?? 'http://organizer:8080'

async function runGenerator() {
  logger.info('Wallet Initializing - get ID from organizer')
  const registerResponse = await fetch(`${organizerUrl}/register`, {
    method: 'post',
    body: JSON.stringify({
      role: 'wallet',
    }),
  })
  const registered = await registerResponse.json()

  logger.info(`Wallet selected account index ${registered.ID + 3}`)

  // Wait deposit sequence
  let ready = false
  logger.info(`Standby for deposit are ready`)
  while (!ready) {
    try {
      const readyResponse = await fetch(`${organizerUrl}/canDeposit`, {
        method: 'post',
        body: JSON.stringify({
          ID: registered.ID,
        }),
      })
      ready = await readyResponse.json()
    } catch (error) {
      logger.info(`Error checking organizer ready - ${error}`)
    }
    await sleep(5000)
  }

  const { hdWallet, mockupDB, webSocketProvider } = await getBase(
    config.testnetUrl,
    config.mnemonic,
    'helloworld',
  )
  const walletAccount = await hdWallet.createAccount(+registered.ID + 3)

  const walletNode: FullNode = await FullNode.new({
    provider: webSocketProvider,
    address: config.zkopruContract, // Zkopru contract
    db: mockupDB,
    accounts: [walletAccount],
  })

  // Assume that account index 0, 1, 2 are reserved
  // Account #0 - Coordinator
  // Account #1 - Slasher
  // Account #2 - None
  const transferGeneratorConfig = {
    hdWallet,
    account: walletAccount,
    accounts: [walletAccount],
    node: walletNode,
    noteAmount: { eth: toWei('0.1'), fee: toWei('0.01') },
    erc20: [],
    erc721: [],
    snarkKeyPath: '/proj/keys',
    ID: registered.ID,
    redis: {
      host: redisIp,
      port: 6379,
    },
  }

  const generator = new TransferGenerator(transferGeneratorConfig)

  logger.info(`Start Generate Tansaction`)
  await generator.startGenerator()
}

runGenerator()
