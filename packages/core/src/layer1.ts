import ZkOPRUContract from '@zkopru/contracts'
import { verifyingKeyIdentifier } from '@zkopru/utils'
import { Point, Field } from '@zkopru/babyjubjub'
import Web3 from 'web3'
import { ContractOptions } from 'web3-eth-contract'
import { VerifyingKey } from './snark'

export interface L1Config {
  utxoTreeDepth: number
  withdrawalTreeDepth: number
  nullifierTreeDepth: number
  challengePeriod: number
  minimumStake: string
  referenceDepth: number
  maxUtxoPerTree: string
  maxWithdrawalPerTree: string
  utxoSubTreeDepth: number
  utxoSubTreeSize: number
  withdrawalSubTreeDepth: number
  withdrawalSubTreeSize: number
}

function toPoint(strArr: string[]): Point {
  return Point.from(strArr[0], strArr[1])
}

export class L1Contract extends ZkOPRUContract {
  web3: Web3

  constructor(web3: Web3, address: string, option?: ContractOptions) {
    super(web3, address, option)
    this.web3 = web3
  }

  async getVKs(): Promise<{ [txSig: string]: VerifyingKey }> {
    const NUM_OF_INPUTS = 10
    const NUM_OF_OUTPUTS = 10
    return new Promise<{ [txSig: string]: VerifyingKey }>(resolve => {
      let count = 0
      const vks: { [txSig: string]: VerifyingKey } = {}
      function done() {
        count += 1
        if (count === NUM_OF_INPUTS * NUM_OF_OUTPUTS) {
          resolve(vks)
        }
      }
      for (let nI = 1; nI <= NUM_OF_INPUTS; nI += 1) {
        for (let nO = 1; nO <= NUM_OF_OUTPUTS; nO += 1) {
          this.upstream.methods
            .getVk(nI, nO)
            .call()
            .then(vk => {
              if (Field.from(vk.alfa1[0]).isZero()) done()
              else {
                const sig = verifyingKeyIdentifier(nI, nO)
                vks[sig] = {
                  alfa1: toPoint(vk.alfa1),
                  beta2: { X: toPoint(vk.beta2[0]), Y: toPoint(vk.beta2[1]) },
                  gamma2: {
                    X: toPoint(vk.gamma2[0]),
                    Y: toPoint(vk.gamma2[1]),
                  },
                  delta2: {
                    X: toPoint(vk.delta2[0]),
                    Y: toPoint(vk.delta2[1]),
                  },
                  ic: vk.ic.map(toPoint),
                }
                done()
              }
            })
        }
      }
      return vks
    })
  }

  async getConfig(): Promise<L1Config> {
    // const utxoTreeDepth = await this.upstream.methods
    const utxoTreeDepth = parseInt(
      await this.upstream.methods.UTXO_SUB_TREE_DEPTH().call(),
      10,
    )

    const withdrawalTreeDepth = parseInt(
      await this.upstream.methods.WITHDRAWAL_SUB_TREE_DEPTH().call(),
      10,
    )

    const nullifierTreeDepth = parseInt(
      await this.upstream.methods.NULLIFIER_TREE_DEPTH().call(),
      10,
    )

    const challengePeriod = parseInt(
      await this.upstream.methods.CHALLENGE_PERIOD().call(),
      10,
    )

    const utxoSubTreeDepth = parseInt(
      await this.upstream.methods.UTXO_SUB_TREE_DEPTH().call(),
      10,
    )

    const utxoSubTreeSize = parseInt(
      await this.upstream.methods.UTXO_SUB_TREE_SIZE().call(),
      10,
    )

    const withdrawalSubTreeDepth = parseInt(
      await this.upstream.methods.WITHDRAWAL_SUB_TREE_SIZE().call(),
      10,
    )

    const withdrawalSubTreeSize = parseInt(
      await this.upstream.methods.WITHDRAWAL_SUB_TREE_SIZE().call(),
      10,
    )

    const minimumStake = await this.upstream.methods.MINIMUM_STAKE().call()

    const referenceDepth = parseInt(
      await this.upstream.methods.REF_DEPTH().call(),
      10,
    )

    const maxUtxoPerTree = await this.upstream.methods
      .MAX_UTXO_PER_TREE()
      .call()

    const maxWithdrawalPerTree = await this.upstream.methods
      .MAX_WITHDRAWAL_PER_TREE()
      .call()

    return {
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
