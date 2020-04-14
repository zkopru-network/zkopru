import { fetch } from 'node-fetch'
import { MerkleProof } from '@zkopru/tree'
import { Field } from '@zkopru/babyjubjub'

export interface BootstrapData {
  proposalHash: string
  utxoTreeIndex: number
  utxoTreeBootstrap: MerkleProof
  withdrawalTreeIndex: number
  withdrawalTreeBootstrap: MerkleProof
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
      utxoTreeIndex: response.utxoTreeIndex,
      utxoTreeBootstrap: {
        root: Field.from(response.utxoBootstrap.root),
        index: Field.from(response.utxoBootstrap.index),
        leaf: Field.from(response.utxoBootstrap.leaf),
        siblings: response.utxoBootstrap.siblings.map(Field.from),
      },
      withdrawalTreeIndex: response.withdrawalTreeIndex,
      withdrawalTreeBootstrap: {
        root: Field.from(response.withdrawalBootstrap.root),
        index: Field.from(response.withdrawalBootstrap.index),
        leaf: Field.from(response.withdrawalBootstrap.leaf),
        siblings: response.withdrawalBootstrap.siblings.map(Field.from),
      },
    }
  }
}
