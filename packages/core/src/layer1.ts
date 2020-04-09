import ZkOPRUContract from '@zkopru/contracts'
import { poseidonHasher, keccakHasher } from '@zkopru/tree'
import { verifyingKeyIdentifier } from '@zkopru/utils'
import { Point, Field } from '@zkopru/babyjubjub'
import Web3 from 'web3'
import { ContractOptions } from 'web3-eth-contract'
import bigInt, { BigNumber } from 'big-integer'
import { Block } from './block'
import { VerifyingKey } from './snark'

export interface Configuration {
  utxoTreeDepth: number
  withdrawalTreeDepth: number
  nullifierTreeDepth: number
  utxoPreHashes: string[]
  withdrawalPreHashes: string[]
  nullifierPreHashes: string[]
  subTreeDepth: number
  subTreeSize: number
  challengePeriod: number
  minimumStake: BigNumber
  referenceDepth: number
  poolSize: BigNumber
}

function toPoint(strArr: string[]): Point {
  return Point.from(strArr[0], strArr[1])
}

export class Layer1 extends ZkOPRUContract {
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

  async getConfig(): Promise<Configuration> {
    const defaultConfig: Configuration = {
      utxoTreeDepth: 31,
      withdrawalTreeDepth: 31,
      nullifierTreeDepth: 255,
      utxoPreHashes: poseidonHasher(31).preHash.map(field => field.toString()),
      withdrawalPreHashes: keccakHasher(31).preHash.map(field =>
        field.toString(),
      ),
      nullifierPreHashes: keccakHasher(255).preHash.map(field =>
        field.toString(),
      ),
      subTreeDepth: 5,
      subTreeSize: 31,
      challengePeriod: 7 * 24 * 3600,
      minimumStake: `32${Array(18)
        .fill('0')
        .join('')}`,
      referenceDepth: 128,
      poolSize: bigInt(1)
        .shiftLeft(31)
        .toString(10),
    }
    console.log(this.user.defaultAccount)
    return defaultConfig as Configuration
  }

  async fetchBlocks(
    ethereumBlockNum: number,
    onBlock: (block: Block) => Promise<void>,
  ) {
    this.coordinator.events
      .NewProposal({ fromBlock: ethereumBlockNum })
      .on('connected', subId => {
        console.log(subId)
      })
      .on('data', async event => {
        const { returnValues, transactionHash, blockNumber } = event
        console.log(returnValues, transactionHash, blockNumber)
        const tx = await this.web3.eth.getTransaction(transactionHash)
        onBlock(Block.fromLayer1Tx(tx))
      })
      .on('changed', event => {
        // removed
        console.log(event)
      })
      .on('error', err => {
        console.log(err)
      })
  }
}
