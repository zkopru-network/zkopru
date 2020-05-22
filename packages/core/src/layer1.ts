/* eslint-disable @typescript-eslint/camelcase */
import ZkOPRUContract from '@zkopru/contracts'
import { L1Config } from '@zkopru/database'
import { verifyingKeyIdentifier } from '@zkopru/utils'
import Web3 from 'web3'
import { ContractOptions } from 'web3-eth-contract'
import bigInt from 'big-integer'
import * as ffjs from 'ffjavascript'
import { VerifyingKey } from './snark'

export class L1Contract extends ZkOPRUContract {
  web3: Web3

  constructor(web3: Web3, address: string, option?: ContractOptions) {
    super(web3, address, option)
    this.web3 = web3
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
            [bigInt(vk.beta2[1][1]), bigInt(vk.beta2[1][1])],
            [bigInt('1'), bigInt('0')],
          ]
          const vk_gamma_2 = [
            [bigInt(vk.gamma2[0][0]), bigInt(vk.gamma2[0][1])],
            [bigInt(vk.gamma2[1][1]), bigInt(vk.gamma2[1][1])],
            [bigInt('1'), bigInt('0')],
          ]
          const vk_delta_2 = [
            [bigInt(vk.delta2[0][0]), bigInt(vk.delta2[0][1])],
            [bigInt(vk.delta2[1][1]), bigInt(vk.delta2[1][1])],
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

  async getConfig(): Promise<L1Config> {
    let genesisBlock!: string
    let utxoTreeDepth!: number
    let withdrawalTreeDepth!: number
    let nullifierTreeDepth!: number
    let challengePeriod!: number
    let minimumStake!: string
    let referenceDepth!: number
    let maxUtxoPerTree!: string
    let maxWithdrawalPerTree!: string
    let utxoSubTreeDepth!: number
    let utxoSubTreeSize!: number
    let withdrawalSubTreeDepth!: number
    let withdrawalSubTreeSize!: number
    // const utxoTreeDepth = await this.upstream.methods
    const tasks = [
      async () => {
        genesisBlock = await this.upstream.methods.latest().call()
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
        maxUtxoPerTree = await this.upstream.methods.MAX_UTXO_PER_TREE().call()
      },
      async () => {
        maxWithdrawalPerTree = await this.upstream.methods
          .MAX_WITHDRAWAL_PER_TREE()
          .call()
      },
    ]
    await Promise.all(tasks.map(task => task()))
    return {
      genesisBlock,
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
      maxUtxoPerTree,
      maxWithdrawalPerTree,
    }
  }
}
