/* eslint-disable @typescript-eslint/no-explicit-any */
import Web3 from 'web3'
import { Account, TransactionReceipt } from 'web3-core'
import { TransactionObject, Tx } from './contracts/types'

export class TxUtil {
  static async getSignedTransaction<T>(
    tx: TransactionObject<T>,
    address: string,
    web3: Web3,
    account: Account,
    option?: Tx,
  ): Promise<string> {
    const [ gas, gasPrice, nonce ] = await Promise.all([
      tx.estimateGas({
        ...option,
        from: account.address,
      }),
      web3.eth.getGasPrice(),
      web3.eth.getTransactionCount(account.address, 'pending')
    ])
    const { rawTransaction } = await web3.eth.accounts.signTransaction({
      nonce,
      gasPrice,
      gas,
      to: address,
      value: typeof option?.value === 'string' ? option.value : '0x0',
      data: tx.encodeABI(),
    }, account.privateKey)
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
    let receipt: TransactionReceipt
    try {
      receipt = await web3.eth.sendSignedTransaction(signedTx)
    } catch (err) {
      throw Error(err)
    }
    return receipt
  }
}
