/* eslint-disable @typescript-eslint/no-explicit-any */
import Web3 from 'web3'
import { Account, TransactionReceipt } from 'web3-core'
import { Fp } from '@zkopru/babyjubjub'
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
    let selectedGas: number

    // To Prevent using `option.gas` lower than estimated gas
    if (!option?.gas) {
      selectedGas = await tx.estimateGas({ ...option, from: account.address })
    } else {
      const { gas, ...otherOption } = option
      const estimateGas = await tx.estimateGas({
        ...otherOption,
        from: account.address,
      })
      const optionGas = Fp.from(gas).toNumber()

      if (optionGas >= estimateGas) {
        selectedGas = optionGas
      } else {
        selectedGas = estimateGas
        logger.info(
          `Lower than estimated Gas, Using gas amount as ${selectedGas} instead of ${option.gas} `,
        )
      }
    }

    if (option?.gasPrice) {
      gasPrice = Fp.from(option.gasPrice).toString()
    } else {
      gasPrice = await web3.eth.getGasPrice()
    }

    const value = option ? (option as PayableTx).value : undefined
    const { rawTransaction } = await web3.eth.accounts.signTransaction(
      {
        gasPrice,
        gas: selectedGas,
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
    return web3.eth.sendSignedTransaction(signedTx)
  }
}
