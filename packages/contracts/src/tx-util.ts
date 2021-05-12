/* eslint-disable @typescript-eslint/no-explicit-any */
import BN from 'bn.js'
import Web3 from 'web3'
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
    const { rawTransaction } = await web3.eth.accounts.signTransaction(
      {
        gasPrice,
        gas,
        to: address,
        value,
        data: tx.encodeABI(),
      },
      account.privateKey,
    )
    return rawTransaction as string
  }

  static async sendTx<T>(
    tx: TransactionObject<T>,
    address: string,
    web3: Web3,
    account: Account,
    option?: Tx,
  ): Promise<TransactionReceipt | undefined> {
    const signedTx = await this.getSignedTransaction(
      tx,
      address,
      web3,
      account,
      option,
    )
    const receipt = await web3.eth.sendSignedTransaction(signedTx)
    if (option?.gas && !receipt?.status) {
      logger.info('Check gas amount for this transaction revert')
    }
    return receipt
  }
}
