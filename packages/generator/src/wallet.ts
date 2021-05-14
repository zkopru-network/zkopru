/* eslint-disable no-case-declarations */
import fs from 'fs'
import Web3 from 'web3'
import { toWei } from 'web3-utils'
import { Transform } from 'stream'

import { F, Fp } from '@zkopru/babyjubjub'
import { FullNode } from '@zkopru/core'
import { TxBuilder, UtxoStatus, Utxo, RawTx } from '@zkopru/transaction'
import { SQLiteConnector, schema } from '@zkopru/database/dist/node'
// import { ZkopruWallet } from '@zkopru/client'
import { logStream, logger, sleep } from '@zkopru/utils'
import prettier from 'pino-pretty'
import { ZkWallet } from '~zk-wizard'
import { getProviders, genAccounts, logAll, getLocalIP } from './baseGenerator'
// import { ZkAccount } from '~account/account'

// Config Params
const testnet = 'ws://testnet:5000'
const mnemonic =
  'myth like bonus scare over problem client lizard pioneer submit female collect'
const zkopruContract = '0x970e8f18ebfEa0B08810f33a5A40438b9530FBCF'

// TODO: Type 'F' look does not need to
const eth: F = toWei('10000000000000000', 'wei')
const fee: F = toWei('5000000000000000', 'wei')

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

async function testWallet() {
  logger.info('Run Test Wallet')
  const { hdWallet, webSocketProvider } = await getProviders(
    testnet,
    mnemonic,
    'helloworld',
  )

  const accounts = await genAccounts(hdWallet, 6)
  const mockupDB = await SQLiteConnector.create(schema, ':memory:')
  const walletNode: FullNode = await FullNode.new({
    provider: webSocketProvider,
    address: zkopruContract, // Zkopru contract
    db: mockupDB,
    accounts,
  })

  // const wallet = new ZkopruWallet()

  const wallet = new ZkWallet({
    db: mockupDB,
    wallet: hdWallet,
    node: walletNode,
    accounts,
    erc20: [],
    erc721: [],
    snarkKeyPath: '/proj/packages/circuits/keys', // TODO: make more flexible
  })

  wallet.createAccount(4)

  await wallet.node.start()
  logger.info(`Set Wallet Account to ${logAll(wallet.account)}`)

  let depositCounter = 0

  while (depositCounter < 100) {
    logger.info(
      `[Wallet] Account ${
        accounts[4].ethAddress
      } sent deposit Tx - Times ${depositCounter + 1}`,
    )
    try {
      const result = await wallet.depositEther(eth, fee, accounts[4].zkAddress)
      if (!result) {
        throw new Error('[Wallet] Deposit Transaction Failed!')
      }
    } catch (err) {
      logger.error(err)
    }
    await sleep(12000 + depositCounter * 1000)

    // 4. Wait for propose Block
    logger.info(
      `[Wallet] Current processed ? ${wallet.node.synchronizer.latestProcessed}`,
    )
    if (wallet.node.synchronizer.latestProcessed) break

    depositCounter += 1
  }

  // Ready to send Transfer

  let txBuilder: TxBuilder
  let spendables: Utxo[]
  let unspentUTXO: Utxo[]
  let spendingUTXO: Utxo[]
  let spentUTXO: Utxo[]
  let tx: RawTx
  let Counter = 1

  const weiPrice = toWei('4000', 'gwei')

  for (let i = 0; i < 100; i++) {
    unspentUTXO = await wallet.getUtxos(accounts[4], UtxoStatus.UNSPENT)

    if (unspentUTXO.length === 0) {
      logger.info('[Wallet] No Spendable Utxo, send Deposit Tx')
      try {
        const result = await wallet.depositEther(
          eth,
          fee,
          accounts[4].zkAddress,
        )
        if (!result) {
          throw new Error('[Wallet] Deposit Transaction Failed!')
        }
      } catch (err) {
        logger.error(err)
      }
      await sleep(10000)
      continue
    }

    logger.info(`[Wallt] Send Tx to Layer2 >> Time ${Counter}`)
    spendables = await wallet.getSpendables(accounts[4])

    txBuilder = TxBuilder.from(accounts[4].zkAddress)

    tx = txBuilder
      .provide(...spendables.map(note => Utxo.from(note)))
      .weiPerByte(weiPrice)
      .sendEther({ eth: Fp.from(eth).div(2), to: accounts[4].zkAddress })
      .build()

    // This is shiled Tx
    logger.info(`[Wallet] Builded Tx >> ${logAll(tx)}`)

    try {
      await wallet.sendTx({
        tx,
        from: accounts[4],
        encryptTo: accounts[4].zkAddress,
      })
    } catch (err) {
      logger.error(err)
      logger.error(tx)
    }

    spentUTXO = await wallet.getUtxos(accounts[4], UtxoStatus.SPENT)
    unspentUTXO = await wallet.getUtxos(accounts[4], UtxoStatus.UNSPENT)
    spendingUTXO = await wallet.getUtxos(accounts[4], UtxoStatus.SPENDING)
    logger.info(
      `[Wallet] After send Tx UTXOs, 'unpent : ${unspentUTXO.length}', 'spending : ${spendingUTXO.length}', 'spent : ${spentUTXO.length}'`,
    )
    Counter += 1
  }
}

async function main() {
  await testWallet()
}

main()
