import { fetch } from 'node-fetch'
import { MerkleProof } from '@zkopru/tree'
import { Field } from '@zkopru/babyjubjub'
import { Block } from './block'

export interface BootstrapData {
  blockNum: number
  block: Block
  utxoTreeBootstrap: MerkleProof
  withdrawalTreeBootstrap: MerkleProof
}

export interface BootstrapNode {
  fetchBootstrapData(): Promise<BootstrapData>
}

export class HttpBootstrapNode implements BootstrapNode {
  endpoint: string

  constructor(endpoint: string) {
    this.endpoint = endpoint
  }

  async fetchBootstrapData(): Promise<BootstrapData> {
    const response: any = await fetch(`${this.endpoint}/bootstrap`)
    return {
      blockNum: response.blockNum,
      block: response.block,
      utxoTreeBootstrap: {
        root: Field.from(response.utxoBootstrap.root),
        index: Field.from(response.utxoBootstrap.index),
        leaf: Field.from(response.utxoBootstrap.leaf),
        siblings: response.utxoBootstrap.siblings.map(Field.from),
      },
      withdrawalTreeBootstrap: {
        root: Field.from(response.withdrawalBootstrap.root),
        index: Field.from(response.withdrawalBootstrap.index),
        leaf: Field.from(response.withdrawalBootstrap.leaf),
        siblings: response.withdrawalBootstrap.siblings.map(Field.from),
      },
    }
  }
}
