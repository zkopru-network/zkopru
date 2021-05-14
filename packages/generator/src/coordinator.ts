/* eslint-disable no-case-declarations */
import fs from 'fs'
import dns from 'dns'
import Web3 from 'web3'
import { Transform } from 'stream'

import { FullNode } from '@zkopru/core'
import { Coordinator } from '@zkopru/coordinator'
import { SQLiteConnector, schema } from '@zkopru/database/dist/node'
import { logStream, logger } from '@zkopru/utils'
import prettier from 'pino-pretty'
import { getProviders, genAccounts, logAll, getLocalIP } from './baseGenerator'

// Config Params
const testnet = 'ws://testnet:5000'
const mnemonic =
  'myth like bonus scare over problem client lizard pioneer submit female collect'
const zkopruContract = '0x970e8f18ebfEa0B08810f33a5A40438b9530FBCF'

const writeStream = fs.createWriteStream('./COORDINATOR_LOG')
logStream.addStream(writeStream)
const pretty = prettier({
  translateTime: false,
  colorize: true,
})
const prettyStream = new Transform({
  transform: (chunk, _, cb) => {
    cb(null, pretty(JSON.parse(chunk.toString())))
  },
})
prettyStream.pipe(process.stdout)
logStream.addStream(prettyStream)

async function testCoodinator() {
  logger.info('Run Test Coodinator')
  const { hdWallet, webSocketProvider } = await getProviders(
    testnet,
    mnemonic,
    'helloworld',
  )

  // TODO: make up code and go to base.
  const testnetIp = await (async function() {
    return new Promise((resolve, reject) => {
      dns.resolve4('testnet', (error, addresses) => {
        if (error) {
          logger.warn(`DNS resolved error ${error}`)
          logger.warn(`Please check your 'links' in docker-compose file`)
          reject(error)
        } else {
          resolve(addresses)
        }
      })
    })
  })()

  logger.info(`testnet ipf ${testnetIp}`)

  const accounts = await genAccounts(hdWallet, 6)

  const coordinatorMockupDB = await SQLiteConnector.create(schema, ':memory:')
  const fullNode: FullNode = await FullNode.new({
    address: zkopruContract, // Zkopru contract
    provider: webSocketProvider,
    db: coordinatorMockupDB,
    slasher: accounts[1].ethAccount,
  })

  const coordinatorAccount = accounts[0].ethAccount
  const coordinatorIp = getLocalIP() // TODO: Get fency ip address get

  // TODO: update coodinator manager
  const coordinatorConfig = {
    bootstrap: true,
    address: zkopruContract,
    maxBytes: 131072,
    maxBid: 20000,
    vhosts: '*',
    priceMultiplier: 48,
    publicUrls: `${coordinatorIp}:8888`, // TODO: set coordinator container's IP
    port: 8888,
  }

  const coordinator = new Coordinator(
    fullNode,
    coordinatorAccount,
    coordinatorConfig,
  )

  // 1. Run coordinator
  await coordinator.start()

  const events = ['start', 'stop']
  events.forEach(event => {
    coordinator.on(event, res =>
      logger.info(`Coordinator >>>>> [${event}] >`, res),
    )
  })
  // TODO: Set context like integrated test
}

async function main() {
  await testCoodinator()
}

main()
