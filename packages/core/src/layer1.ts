/* eslint-disable @typescript-eslint/camelcase */
import { ZkOPRUContract } from '@zkopru/contracts'
import { Config } from '@zkopru/prisma'
import { Account, TransactionReceipt } from 'web3-core'
import { verifyingKeyIdentifier, logger, hexify } from '@zkopru/utils'
import Web3 from 'web3'
import { ContractOptions } from 'web3-eth-contract'
import bigInt from 'big-integer'
import * as ffjs from 'ffjavascript'
import { soliditySha3 } from 'web3-utils'
import Transaction from 'ethereumjs-tx'
import { NumString } from 'soltypes'
import { VerifyingKey } from './snark'
import { TransactionObject, Tx } from './types/contract'

export class L1Contract extends ZkOPRUContract {
  web3: Web3

  address: string

  config?: Config

  constructor(web3: Web3, address: string, option?: ContractOptions) {
    super(web3, address, option)
    this.web3 = web3
    this.address = address
  }

  async getVKs(): Promise<{ [txSig: string]: VerifyingKey }> {
    const NUM_OF_INPUTS = 4
    const NUM_OF_OUTPUTS = 4
    const vks: { [txSig: string]: VerifyingKey } = {}
    const tasks: (() => Promise<void>)[] = []
    // const stringify = (val: unknown) => bigInt(val).toString(10)
    for (let nI = 1; nI <= NUM_OF_INPUTS; nI += 1) {
      for (let nO = 1; nO <= NUM_OF_OUTPUTS; nO += 1) {
        tasks.push(async () => {
          const vk = await this.upstream.methods.getVk(nI, nO).call()
          const sig = verifyingKeyIdentifier(nI, nO)
          const vk_alfa_1 = [
            bigInt(vk.alfa1[0]),
            bigInt(vk.alfa1[1]),
            bigInt('1'),
          ]
          const vk_beta_2 = [
            [bigInt(vk.beta2[0][0]), bigInt(vk.beta2[0][1])],
            [bigInt(vk.beta2[1][0]), bigInt(vk.beta2[1][1])],
            [bigInt('1'), bigInt('0')],
          ]
          const vk_gamma_2 = [
            [bigInt(vk.gamma2[0][0]), bigInt(vk.gamma2[0][1])],
            [bigInt(vk.gamma2[1][0]), bigInt(vk.gamma2[1][1])],
            [bigInt('1'), bigInt('0')],
          ]
          const vk_delta_2 = [
            [bigInt(vk.delta2[0][0]), bigInt(vk.delta2[0][1])],
            [bigInt(vk.delta2[1][0]), bigInt(vk.delta2[1][1])],
            [bigInt('1'), bigInt('0')],
          ]
          const vk_alfabeta_12 = ffjs.bn128.pairing(
            ffjs.utils.unstringifyBigInts(
              ffjs.utils.stringifyBigInts(vk_alfa_1),
            ),
            ffjs.utils.unstringifyBigInts(
              ffjs.utils.stringifyBigInts(vk_beta_2),
            ),
          )
          const IC = vk.ic.map(ic => [bigInt(ic[0]), bigInt(ic[1]), bigInt(1)])
          vks[sig] = {
            protocol: 'groth',
            nPublic: vk.ic.length - 1,
            vk_alfa_1,
            vk_beta_2,
            vk_gamma_2,
            vk_delta_2,
            vk_alfabeta_12,
            IC,
          }
        })
      }
    }
    await Promise.all(tasks.map(task => task()))
    return vks
  }

  async getConfig(): Promise<Config> {
    if (this.config) return this.config
    let networkId!: number
    let chainId!: number
    let utxoTreeDepth!: number
    let withdrawalTreeDepth!: number
    let nullifierTreeDepth!: number
    let challengePeriod!: number
    let minimumStake!: string
    let referenceDepth!: number
    let maxUtxo!: string
    let maxWithdrawal!: string
    let utxoSubTreeDepth!: number
    let utxoSubTreeSize!: number
    let withdrawalSubTreeDepth!: number
    let withdrawalSubTreeSize!: number
    /** test start */
    /** test ends */
    const tasks = [
      async () => {
        networkId = await this.web3.eth.net.getId()
      },
      async () => {
        chainId = await this.web3.eth.getChainId()
      },
      async () => {
        utxoTreeDepth = parseInt(
          await this.upstream.methods.UTXO_TREE_DEPTH().call(),
          10,
        )
      },
      async () => {
        withdrawalTreeDepth = parseInt(
          await this.upstream.methods.WITHDRAWAL_TREE_DEPTH().call(),
          10,
        )
      },
      async () => {
        nullifierTreeDepth = parseInt(
          await this.upstream.methods.NULLIFIER_TREE_DEPTH().call(),
          10,
        )
      },
      async () => {
        challengePeriod = parseInt(
          await this.upstream.methods.CHALLENGE_PERIOD().call(),
          10,
        )
      },
      async () => {
        utxoSubTreeDepth = parseInt(
          await this.upstream.methods.UTXO_SUB_TREE_DEPTH().call(),
          10,
        )
      },
      async () => {
        utxoSubTreeSize = parseInt(
          await this.upstream.methods.UTXO_SUB_TREE_SIZE().call(),
          10,
        )
      },
      async () => {
        withdrawalSubTreeDepth = parseInt(
          await this.upstream.methods.WITHDRAWAL_SUB_TREE_DEPTH().call(),
          10,
        )
      },
      async () => {
        withdrawalSubTreeSize = parseInt(
          await this.upstream.methods.WITHDRAWAL_SUB_TREE_SIZE().call(),
          10,
        )
      },
      async () => {
        minimumStake = await this.upstream.methods.MINIMUM_STAKE().call()
      },
      async () => {
        referenceDepth = parseInt(
          await this.upstream.methods.REF_DEPTH().call(),
          10,
        )
      },
      async () => {
        maxUtxo = await this.upstream.methods.MAX_UTXO().call()
      },
      async () => {
        maxWithdrawal = await this.upstream.methods.MAX_WITHDRAWAL().call()
      },
    ]
    await Promise.all(tasks.map(task => task()))
    const zkopruId = soliditySha3(
      hexify(networkId, 32),
      hexify(chainId, 32),
      hexify(this.address, 20),
    )
    if (!zkopruId) throw Error('hash error to get zkopru id')
    this.config = {
      id: zkopruId,
      networkId,
      chainId,
      address: this.address,
      utxoTreeDepth,
      withdrawalTreeDepth,
      nullifierTreeDepth,
      utxoSubTreeDepth,
      utxoSubTreeSize,
      withdrawalSubTreeDepth,
      withdrawalSubTreeSize,
      challengePeriod,
      minimumStake,
      referenceDepth,
      maxUtxo,
      maxWithdrawal,
    }
    return this.config
  }

  async sendTx(
    tx: TransactionObject<void>,
    account?: Account,
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
            from: account?.address,
          })
          logger.trace(`estimated gas: ${gas}`)
        } catch (err) {
          logger.warn(err)
          throw Error('It may get reverted so did not send the transaction')
        }
        return undefined
      },
      async () => {
        gasPrice = await this.web3.eth.getGasPrice()
      },
      async () => {
        if (account) {
          nonce = await this.web3.eth.getTransactionCount(
            account.address,
            'pending',
          )
        }
      },
    ].map(fetchTask => fetchTask())
    try {
      await Promise.all(promises)
    } catch (err) {
      logger.warn(err)
      return undefined
    }
    if (account) {
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
        to: this.address,
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
        receipt = await this.web3.eth.sendSignedTransaction(
          `0x${ethTx.serialize().toString('hex')}`,
        )
      } catch (err) {
        logger.warn(err)
        return undefined
      }
      return receipt
    }
    let receipt: TransactionReceipt
    try {
      receipt = await tx.send({
        gas,
        gasPrice,
        ...option,
      })
    } catch (err) {
      logger.warn(err)
      return undefined
    }
    return receipt
  }
}
