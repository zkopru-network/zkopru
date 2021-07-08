/* eslint-disable no-case-declarations */
import dns from 'dns'
import { FullNode } from '@zkopru/core'
import { Coordinator } from '@zkopru/coordinator'
import { logger } from '@zkopru/utils'
import { config } from './config'
import { TestBlockProposer } from './middleware'
import { getBase, startLogger } from './generator-utils'

startLogger('COORDINATOR_LOG')

const coordinatorHost = process.env.COORDINATOR_HOST ?? 'coordinator'
const coordinatorPort = 8888

async function dnsLookup(hostname: string) {
  return new Promise((resolve, reject) => {
    dns.lookup(hostname, (err, address) => {
      if (err) reject(err)
      resolve(address)
    })
  })
}

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

  // Have to convert single string hostname to IP
  const coordinatorIp = await dnsLookup(coordinatorHost)

  const coordinatorConfig = {
    bootstrap: true,
    address: config.zkopruContract,
    maxBytes: 131072,
    maxBid: 20000,
    vhosts: '*',
    priceMultiplier: 48,
    publicUrls: `${coordinatorIp}:${coordinatorPort}`, // This is default params, Will be using registered coordinator address on Contract.
    port: coordinatorPort,
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
