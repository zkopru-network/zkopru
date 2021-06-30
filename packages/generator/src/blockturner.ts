/* eslint-disable no-case-declarations */
import path from 'path'
import { toWei } from 'web3-utils'
import fetch from 'node-fetch'

import { FullNode } from '@zkopru/core'
import { logger, sleep } from '@zkopru/utils'
import { ZkWallet } from '@zkopru/zk-wizard'
import { getBase, startLogger } from './generator-utils'
import { config } from './config'

const organizerUrl = process.env.ORGANIZER_URL ?? 'http://organizer:8080'

// TODO: When transfered UTXO discovery features added, This will refactor as ETH supplier for testing wallets
startLogger(`./BLOCKTURNNER_LOG`)

// Block Turner is for Zkopru layer 2 chain being continue by deposit tx with enough fee
async function runBlockTurner() {
  // TODO : refactor waiting trigger as deposit event listen
  let ready = false
  logger.info(`Standby for All wallets are registered to organizer`)
  while (!ready) {
    try {
      const registerResponse = await fetch(`${organizerUrl}/registered`, {
        method: 'get',
      })
      const walletData = await registerResponse.json()
      const walletStatus = walletData.map(wallet => {
        return wallet.from !== ''
      })

      if (!walletStatus.includes(false)) {
        ready = true
      }
    } catch (error) {
      logger.info(`Error checking organizer ready - ${error}`)
    }
    await sleep(14000)
  }
  await sleep(35000)

  logger.info('Layer2 block turner Initializing')
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
  // Account #2 - Turner
  const walletAccount = await hdWallet.createAccount(2)
  const turnerConfig = {
    wallet: hdWallet,
    account: walletAccount,
    accounts: [walletAccount],
    node: walletNode,
    erc20: [],
    erc721: [],
    snarkKeyPath: path.join(__dirname, '../../circuits/keys'),
  }

  const turner = new ZkWallet(turnerConfig)
  turner.node.start()
  turner.setAccount(walletAccount)

  // let stagedDeposits
  let depositTimer
  function depositLater() {
    depositTimer = setTimeout(async () => {
      logger.info(`No proposal detected in about 15 blocks, Sending deposit Tx`)
      const result = await turner.depositEther(
        toWei('1', 'wei'),
        toWei('0.005'),
      )
      if (!result) {
        throw new Error('Deposit Transaction Failed!')
      }
    }, 14000 * 15) // about 15 blocks period time
  }

  depositLater()

  let lastProposalAt = 0
  walletNode.layer1.coordinator.events
    .NewProposal({ fromBlock: lastProposalAt })
    .on('connected', subId => {
      logger.info(`Additional proposal event watch Id: ${subId}`)
    })
    .on('data', async event => {
      const { returnValues, blockNumber } = event
      const { proposalNum, blockHash } = returnValues
      logger.info(`newProposal: ${proposalNum} - ${blockHash} @ ${blockNumber}`)
      lastProposalAt = blockNumber

      // Reset timer for deposit
      clearTimeout(depositTimer)
      depositLater()
    })
}

runBlockTurner()
