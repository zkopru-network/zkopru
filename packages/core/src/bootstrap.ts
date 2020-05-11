import { fetch } from 'node-fetch'
import { MerkleProof } from '@zkopru/tree'
import { Field } from '@zkopru/babyjubjub'
import BN from 'bn.js'

export interface BootstrapData {
  proposalHash: string
  blockHash: string
  utxoTreeIndex: number
  utxoStartingLeafProof: MerkleProof<Field>
  withdrawalTreeIndex: number
  withdrawalStartingLeafProof: MerkleProof<BN>
}

export interface BootstrapHelper {
  fetchBootstrapData(latest: string): Promise<BootstrapData>
}

export class HttpBootstrapHelper implements BootstrapHelper {
  endpoint: string

  constructor(endpoint: string) {
    this.endpoint = endpoint
  }

  async fetchBootstrapData(latest: string): Promise<BootstrapData> {
    const response: any = await fetch(
      `${this.endpoint}/bootstrap?hash=${latest}`,
    )
    return {
      proposalHash: response.proposalHash,
      blockHash: response.blockHash,
      utxoTreeIndex: response.utxoTreeIndex,
      utxoStartingLeafProof: {
        root: Field.from(response.utxoBootstrap.root),
        index: Field.from(response.utxoBootstrap.index),
        leaf: Field.from(response.utxoBootstrap.leaf),
        siblings: response.utxoBootstrap.siblings.map(Field.from),
      },
      withdrawalTreeIndex: response.withdrawalTreeIndex,
      withdrawalStartingLeafProof: {
        root: Field.from(response.withdrawalBootstrap.root),
        index: Field.from(response.withdrawalBootstrap.index),
        leaf: Field.from(response.withdrawalBootstrap.leaf),
        siblings: response.withdrawalBootstrap.siblings.map(Field.from),
      },
    }
  }
}
