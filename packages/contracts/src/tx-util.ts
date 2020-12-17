/* eslint-disable @typescript-eslint/no-explicit-any */
import Web3 from 'web3'
import { Account, TransactionReceipt } from 'web3-core'
import { TransactionObject, Tx } from './contracts/types'

export class TxUtil {
  // Number of pending transactions keyed to address
  static pendingTransactions = {} as { [key: string]: number }

  static pendingTxCount(address: string) {
    return (this.pendingTransactions[address] || 0)
  }

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
      web3.eth.getTransactionCount(account.address, 'latest')
    ])
    const { rawTransaction } = await web3.eth.accounts.signTransaction({
      nonce: nonce + this.pendingTxCount(account.address),
      gasPrice,
      gas,
      to: address,
      value: option?.value,
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
      this.pendingTransactions[account.address] = this.pendingTxCount(account.address) + 1
      receipt = await web3.eth.sendSignedTransaction(signedTx)
      this.pendingTransactions[account.address] -= 1
    } catch (err) {
      this.pendingTransactions[account.address] -= 1
      throw Error(err)
    }
    return receipt
  }
}
