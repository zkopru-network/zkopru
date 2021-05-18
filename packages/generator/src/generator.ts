import BN from 'bn.js'
import { toWei } from 'web3-utils'

import { DB } from '@zkopru/database'
import { TxBuilder, UtxoStatus, Utxo, RawTx } from '@zkopru/transaction'
import { HDWallet, ZkAccount } from '@zkopru/account'
import { logger, sleep } from '@zkopru/utils'
import { F } from '~babyjubjub/fp'
import { ZkWallet } from '~zk-wizard'
import {
  ZkWalletAccount,
  ZkWalletAccountConfig,
} from '~zk-wizard/zk-wallet-account'
import { logAll } from './generator-utils'

// TODO : extends to other type of assets
export type noteAmount = { eth: string; fee: string }

export interface GeneratorConfig {
  db: DB
  hdWallet: HDWallet
  account: ZkAccount
  noteAmount?: noteAmount
  maxInflowNote?: number // Can be extend to 4
  weiPrice?: string
}

export class TransferGenerator extends ZkWalletAccount {
  private hdWallet: HDWallet

  wallet: ZkWallet

  activating: boolean

  txCount: number

  noteAmount: noteAmount

  unspentUTXO: Utxo[]

  onQueueUTXOSalt: F[]

  maxInflowNote: number // Can be extend up to 4, over 4 will be error.

  weiPrice: string

  constructor(config: ZkWalletAccountConfig & GeneratorConfig) {
    super(config)
    this.activating = false
    this.txCount = 0

    this.hdWallet = config.hdWallet

    // TODO: More base generator can be added erc20 or erc721
    this.wallet = new ZkWallet({
      db: config.db,
      wallet: this.hdWallet,
      node: this.node,
      account: config.account,
      accounts: [config.account],
      erc20: [],
      erc721: [],
      snarkKeyPath: config.snarkKeyPath,
    })
    this.noteAmount = config.noteAmount ?? {
      eth: toWei('0.1'),
      fee: toWei('0.01'),
    }
    this.unspentUTXO = []
    this.onQueueUTXOSalt = []
    this.maxInflowNote = config.maxInflowNote ?? 2 // If set 1 It will increasing notes
    this.weiPrice = config.weiPrice ?? toWei('2000', 'gwei')
  }

  async startGenerator() {
    if (!this.node.isRunning()) {
      this.node.start()
    }

    this.activating = true

    let tx: RawTx
    let sendableUtxo: Utxo[]
    let stagedUtxo

    while (this.activating) {
      this.unspentUTXO = await this.wallet.getUtxos(
        this.account,
        UtxoStatus.UNSPENT,
      )

      // Dequeue necessary?

      // Deposit if does not exist unspent utxo in this wallet
      if (this.unspentUTXO.length === 0) {
        logger.info('No Spendable Utxo, send Deposit Tx')
        try {
          const result = await this.wallet.depositEther(
            this.noteAmount.eth,
            this.noteAmount.fee,
            this.account?.zkAddress,
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

      // generate transfer Tx...
      // All transaction are self transaction with same amount, only unique things is salt.
      sendableUtxo = []

      for (const utxo of this.unspentUTXO) {
        stagedUtxo = utxo
        for (let i = 0; i < this.onQueueUTXOSalt.length; i++) {
          if (this.onQueueUTXOSalt[i] == utxo.salt) {
            stagedUtxo = null
            break
          }
        }
        if (stagedUtxo) {
          sendableUtxo.push(stagedUtxo) // last utxo always in
        }
        // No need to be find all unspent utxo
        if (sendableUtxo.length > this.maxInflowNote) {
          logger.info(`sendable UTXO salts are ${logAll(sendableUtxo)}`)
          break
        }
      }

      if (sendableUtxo) {
        const txBuilder = TxBuilder.from(this.account?.zkAddress!)
        tx = txBuilder
          .provide(...sendableUtxo)
          .weiPerByte(this.weiPrice)
          .sendEther({
            eth: new BN(this.noteAmount.eth).div(new BN(100)),
            to: this.account?.zkAddress!,
          })
          .build()

        try {
          await this.wallet.sendTx({
            tx,
            from: this.account,
            encryptTo: this.account?.zkAddress,
          })
          sendableUtxo.forEach(utxo => {
            this.onQueueUTXOSalt.push(utxo.salt)
          })
          this.txCount += 1
        } catch (err) {
          logger.error(err)
        }
      }
    }
  }

  stopGenerator() {
    this.activating = false
  }
}
