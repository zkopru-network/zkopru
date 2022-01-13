/* eslint-disable @typescript-eslint/no-explicit-any */
import BN from 'bn.js'
import Web3 from 'web3'
import Common from '@ethereumjs/common'
import { TransactionFactory } from '@ethereumjs/tx'
import { Account, TransactionReceipt } from 'web3-core'
import { logger } from '@zkopru/utils'
import {
  PayableTransactionObject,
  NonPayableTransactionObject,
  PayableTx,
  NonPayableTx,
} from './contracts/types'

export type TransactionObject<T> =
  | PayableTransactionObject<T>
  | NonPayableTransactionObject<T>
export type Tx = PayableTx | NonPayableTx

export class TxUtil {
  static async getSignedTransaction<T>(
    tx: TransactionObject<T>,
    address: string,
    web3: Web3,
    account: Account,
    option?: Tx,
  ): Promise<string> {
    let gasPrice: string
    let gas: number

    if (option?.gas) {
      gas = new BN(option.gas).toNumber()
    } else {
      gas = await tx.estimateGas({
        ...option,
        gas: undefined,
        from: account.address,
      })
    }

    if (option?.gasPrice) {
      gasPrice = new BN(option.gasPrice).toString()
    } else {
      gasPrice = await web3.eth.getGasPrice()
    }

    const value = option ? (option as PayableTx).value : undefined

    // this can be replace with `web3.eth.account.signTransaction`
    // but, there are some benefits using @ethereumjs/tx for signing tx
    // less dependency on web3 version and more accurate gas can be use it
    let rawTransaction
    const nonce = option?.nonce
      ? +option.nonce.toString()
      : await web3.eth.getTransactionCount(account.address, 'pending')
    try {
      const txParams = {
        from: account.address,
        to: address,
        gasPrice: `0x${new BN(gasPrice).toString('hex')}`,
        gasLimit: `0x${new BN(gas).toString('hex')}`,
        value: `0x${new BN(value ?? 0).toString('hex')}`,
        data: tx.encodeABI(),
        nonce,
      }

      const common = await this.getCommon(web3)
      const unSignedTx = TransactionFactory.fromTxData(txParams, { common })
      const signedTx = unSignedTx.sign(
        Buffer.from(account.privateKey.substring(2), 'hex'),
      )

      if (signedTx.isSigned() && !signedTx.verifySignature()) {
        throw new Error(`Invalid Signature`)
      }

      rawTransaction = `0x${signedTx.serialize().toString('hex')}`
    } catch (error) {
      logger.error(
        `contracts/tx-utils - getting signed transaction failed : ${error}`,
      )
    }

    return rawTransaction as string
  }

  // depends on chainId, @ethereumjs supports mainnet and other testchain
  static async getCommon(web3: Web3): Promise<Common> {
    const chainId = await web3.eth.getChainId()
    const knownChainID = [1, 3, 4, 42, 5] // base on enum Chain on @ethereumjs/common

    let common: Common
    if (knownChainID.includes(chainId)) {
      common = new Common({ chain: chainId })
    } else {
      common = Common.custom({ chainId })
    }
    return common
  }

  static async sendTx<T>(
    tx: TransactionObject<T>,
    address: string,
    web3: Web3,
    account: Account,
    option: Tx = {},
  ): Promise<TransactionReceipt | undefined> {
    const sendTx = async (options: Tx = {}) => {
      const signedTx = await this.getSignedTransaction(
        tx,
        address,
        web3,
        account,
        options,
      )
      return web3.eth.sendSignedTransaction(signedTx)
    }
    let gasPrice = option.gasPrice || (await web3.eth.getGasPrice())
    const nonce =
      option.nonce ||
      (await web3.eth.getTransactionCount(account.address, 'pending'))
    const timeoutError = new Error('Timed out')
    for (;;) {
      try {
        const receipt = (await Promise.race([
          sendTx({
            nonce,
            gasPrice,
            ...option,
          }),
          // Timeout after ~10 blocks to avoid losing slots in burn auction
          new Promise((_, rj) =>
            setTimeout(() => rj(timeoutError), 200 * 1000),
          ),
        ])) as TransactionReceipt
        if (option?.gas && !receipt?.status) {
          logger.info('Check gas amount for this transaction revert')
        }
        return receipt
      } catch (err) {
        if (err.toString() !== timeoutError.toString()) {
          // It's not a timeout, throw
          throw err
        }
        logger.info('Rebroadcasting with higher gas price')
        // bump the gas price and go again
        gasPrice = Math.ceil(+gasPrice + +gasPrice * 0.15)
      }
    }
  }
}
