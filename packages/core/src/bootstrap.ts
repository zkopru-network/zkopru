import fetch from 'node-fetch'
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
    const response = await fetch(`${this.endpoint}/bootstrap?hash=${latest}`)
    if (response.ok) {
      const body: any = await response.json()
      console.log('json', response.json())
      console.log('body', response.body)
      return {
        proposalHash: body.proposalHash,
        blockHash: body.blockHash,
        utxoTreeIndex: body.utxoTreeIndex,
        utxoStartingLeafProof: {
          root: Field.from(body.utxoBootstrap.root),
          index: Field.from(body.utxoBootstrap.index),
          leaf: Field.from(body.utxoBootstrap.leaf),
          siblings: body.utxoBootstrap.siblings.map(Field.from),
        },
        withdrawalTreeIndex: body.withdrawalTreeIndex,
        withdrawalStartingLeafProof: {
          root: Field.from(body.withdrawalBootstrap.root),
          index: Field.from(body.withdrawalBootstrap.index),
          leaf: Field.from(body.withdrawalBootstrap.leaf),
          siblings: body.withdrawalBootstrap.siblings.map(Field.from),
        },
      }
    }
    throw Error(`${response.text()}`)
  }
}
