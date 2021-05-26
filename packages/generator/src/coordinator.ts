/* eslint-disable no-case-declarations */
import { FullNode } from '@zkopru/core'
import { Coordinator } from '@zkopru/coordinator'
import { logger } from '@zkopru/utils'
import { config } from './config'
import { TestBlockProposer } from './middleware'
import { getBase, startLogger } from './generator-utils'

startLogger('COORDINATOR_LOG')

async function testCoodinator() {
  logger.info('Run Test Coodinator')
  const { hdWallet, mockupDB, webSocketProvider } = await getBase(
    config.testnetUrl,
    config.mnemonic,
    'helloworld',
  )

  const coordinatorAccount = await hdWallet.createAccount(0)
  const slaherAccount = await hdWallet.createAccount(1)

  const fullNode: FullNode = await FullNode.new({
    address: config.zkopruContract, // Zkopru contract
    provider: webSocketProvider,
    db: mockupDB,
    slasher: slaherAccount.ethAccount,
  })

  const coordinatorIp = process.env.COORDINATOR_IP

  const coordinatorConfig = {
    bootstrap: true,
    address: config.zkopruContract,
    maxBytes: 131072,
    maxBid: 20000,
    vhosts: '*',
    priceMultiplier: 48,
    publicUrls: `${coordinatorIp}:8888`, // This is default params, Will be using registered coordinator address on Contract.
    port: 8888,
  }

  const coordinator = new Coordinator(
    fullNode,
    coordinatorAccount.ethAccount,
    coordinatorConfig,
  )

  // Override Block Generator for Observing
  coordinator.middlewares.proposer = new TestBlockProposer(coordinator.context)

  coordinator.start()
}

testCoodinator()
