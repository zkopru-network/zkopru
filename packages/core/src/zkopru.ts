import { poseidonHasher, keccakHasher } from '@zkopru/tree'
import bigInt, { BigNumber } from 'big-integer'
import { provider } from 'web3-core'
import { ContractOptions } from 'web3-eth-contract'
import Web3 from 'web3'
import ZkOPRUContract from '@zkopru/contracts'

export interface ZkOPRUConfig {
  utxoTreeDepth: number
  withdrawalTreeDepth: number
  nullifierTreeDepth: number
  utxoPreHashes: string[]
  withdrawalPreHashes: string[]
  nullifierPreHashes: string[]
  subTreeDepth: number
  subTreeSize: number
  challengePeriod: number
  challengeLimit: number
  minimumStake: BigNumber
  referenceDepth: number
  poolSize: BigNumber
}

export class ZkOPRU {
  web3: Web3

  address: string

  config: ZkOPRUConfig

  contract: ZkOPRUContract

  constructor({
    provider,
    address,
    option,
    config,
  }: {
    provider: provider
    address: string
    option?: ContractOptions
    config?: ZkOPRUConfig
  }) {
    this.web3 = new Web3(provider)

    this.contract = new ZkOPRUContract(provider, address, option)

    this.address = address
    this.config = config || {
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
      challengePeriod: 7 * 24 * 3600,
      challengeLimit: 8000000,
      minimumStake: bigInt(32).multiply(bigInt(10).pow(18)), // 32 ether
      referenceDepth: 128,
      poolSize: bigInt(1).shiftLeft(31),
      subTreeDepth: 5,
      subTreeSize: 1,
    }
  }
}
