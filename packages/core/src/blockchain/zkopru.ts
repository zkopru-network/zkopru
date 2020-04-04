/* eslint-disable @typescript-eslint/camelcase */

import bigInt, { BigNumber } from 'big-integer'
import { poseidonHasher, keccakHasher } from '../tree/hasher'

export interface ZkOPRUConfig {
  utxoTreeDepth: number
  withdrawalTreeDepth: number
  nullifierTreeDepth: number
  utxoPreHashes: string[]
  withdrawalPreHashes: string[]
  nullifierPreHashes: string[]
  challengePeriod: number
  challengeLimit: number
  minimumStake: BigNumber
  referenceDepth: number
  poolSize: BigNumber
  subTreeDepth: number
  subTreeSize: number
}

export class ZkOPRU {
  networkId: number

  address: string

  config: ZkOPRUConfig

  constructor(networkId: number, address: string, config?: ZkOPRUConfig) {
    this.networkId = networkId
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
