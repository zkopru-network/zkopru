/* eslint-disable no-case-declarations */
import BN from 'bn.js'
import { toWei } from 'web3-utils'

import { FullNode } from '@zkopru/core'
import { TxBuilder, UtxoStatus, Utxo, RawTx } from '@zkopru/transaction'
import { logger, sleep } from '@zkopru/utils'
import { ZkWallet } from '~zk-wizard'
import { getBase, startLogger } from './baseGenerator'
import { config } from './config'

const account_idx: number = parseInt(process.env.ACCOUNT_IDX ?? '0')

const eth: string = toWei('10000000000000000', 'wei')
const fee: string = toWei('0.01')

startLogger('./WALLET_LOG')

async function testWallet() {
  logger.info('Wallet Initializing')
  logger.info(`Wallet selected account index ${account_idx + 3}`)
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

  // Assume that index 0, 1, 2 are reserved
  const walletAccount = await hdWallet.createAccount(3 + account_idx) // TODO: select from docker-compose config

  const wallet = new ZkWallet({
    db: mockupDB,
    wallet: hdWallet,
    node: walletNode,
    accounts: [walletAccount],
    erc20: [],
    erc721: [],
    snarkKeyPath: '/proj/packages/circuits/keys', // TODO: make more flexible
  })

  logger.info(`Wallet node start`)
  wallet.node.start()

  let depositCounter = 0

  // Create Eth note until proposed
  while (depositCounter < 100) {
    try {
      const result = await wallet.depositEther(
        eth,
        fee,
        walletAccount.zkAddress,
      )
      if (!result) {
        throw new Error('[Wallet] Deposit Transaction Failed!')
      }
    } catch (err) {
      logger.error(err)
    }
    await sleep(12000 + depositCounter * 1000)

    if (wallet.node.synchronizer.latestProcessed) break

    depositCounter += 1
  }

  // Ready to send Transfer
  let txBuilder: TxBuilder
  let spendables: Utxo[]
  let unspentUTXO: Utxo[]
  let tx: RawTx

  const weiPrice = toWei('2000', 'gwei') // TODO: make it flexible

  while (true) {
    unspentUTXO = await wallet.getUtxos(walletAccount, UtxoStatus.UNSPENT)

    if (unspentUTXO.length === 0) {
      logger.info('No Spendable Utxo, send Deposit Tx')
      try {
        const result = await wallet.depositEther(
          eth,
          fee,
          walletAccount.zkAddress,
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

    // In this wallet only treat EthNote.
    spendables = await wallet.getSpendables(walletAccount)

    txBuilder = TxBuilder.from(walletAccount.zkAddress)

    // TODO : Need strategy for filtering spendable note before going in txBuilder
    tx = txBuilder
      .provide(...spendables.slice(0, 4).map(note => Utxo.from(note)))
      .weiPerByte(weiPrice)
      .sendEther({
        eth: new BN(eth).div(new BN(100)),
        to: walletAccount.zkAddress,
      })
      .build()

    try {
      await wallet.sendTx({
        tx,
        from: walletAccount,
        encryptTo: walletAccount.zkAddress,
      })
    } catch (err) {
      logger.error(err)
    }

    // Not verify utxo note, just Count for log
    let statusPromise: Promise<number>[] = []

    for (const status in UtxoStatus) {
      if (status.length == 1) {
        statusPromise.push(
          wallet.db.count('Utxo', {
            owner: [walletAccount.zkAddress.toString()],
            status: parseInt(status),
            usedAt: null,
          }),
        )
      }
    }

    const UtxoCount = await Promise.all(statusPromise)

    logger.info(
      `After send Tx UTXOs, 'unpent :  ${
        UtxoCount[UtxoStatus.UNSPENT]
      }', 'spending : ${UtxoCount[UtxoStatus.SPENDING]}', 'spent : ${
        UtxoCount[UtxoStatus.SPENT]
      }'`,
    )
  }
}

testWallet()
