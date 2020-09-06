/* eslint-disable @typescript-eslint/no-explicit-any */
import Web3 from 'web3'
import { Account, TransactionReceipt } from 'web3-core'
import { NumString } from 'soltypes'
import Transaction from 'ethereumjs-tx'
import { TransactionObject, Tx } from './contracts/types'

export class TxUtil {
  static async sendTx<T>(
    tx: TransactionObject<T>,
    address: string,
    web3: Web3,
    account: Account,
    option?: Tx,
  ): Promise<TransactionReceipt | undefined> {
    let gas!: number
    let gasPrice!: string
    let nonce!: number
    const promises = [
      async () => {
        try {
          gas = await tx.estimateGas({
            ...option,
            from: account.address,
          })
        } catch (err) {
          throw err
        }
      },
      async () => {
        gasPrice = await web3.eth.getGasPrice()
      },
      async () => {
        nonce = await web3.eth.getTransactionCount(account.address, 'pending')
      },
    ].map(fetchTask => fetchTask())
    try {
      await Promise.all(promises)
    } catch (err) {
      throw err
    }
    const txParams = {
      nonce: NumString.from(`${nonce}`)
        .toBytes()
        .toString(),
      gasPrice: NumString.from(`${gasPrice}`)
        .toBytes()
        .toString(),
      gasLimit: NumString.from(`${gas}`)
        .toBytes()
        .toString(),
      to: address,
      value:
        typeof option?.value === 'string'
          ? NumString.from(`${option.value}`)
              .toBytes()
              .toString()
          : '0x00',
      data: tx.encodeABI(),
    }
    const ethTx = new Transaction(txParams)
    const hexStr = account.privateKey.startsWith('0x')
      ? account.privateKey.substr(2)
      : account.privateKey
    ethTx.sign(Buffer.from(hexStr, 'hex'))
    let receipt: TransactionReceipt
    try {
      receipt = await web3.eth.sendSignedTransaction(
        `0x${ethTx.serialize().toString('hex')}`,
      )
    } catch (err) {
      throw Error(err)
    }
    return receipt
  }
}
