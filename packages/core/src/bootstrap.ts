import fetch from 'node-fetch'
import { MerkleProof } from '@zkopru/tree'
import { Field } from '@zkopru/babyjubjub'
import BN from 'bn.js'
import { Proposal } from '@zkopru/prisma'
import { logger } from '@zkopru/utils'

export interface BootstrapData {
  proposal: Proposal
  blockHash: string
  utxoStartingLeafProof: MerkleProof<Field>
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
      logger.debug(`json ${response.json()}`)
      logger.debut(`body ${response.body}`)
      return {
        proposal: body.proposal,
        blockHash: body.blockHash,
        utxoStartingLeafProof: {
          root: Field.from(body.utxoBootstrap.root),
          index: Field.from(body.utxoBootstrap.index),
          leaf: Field.from(body.utxoBootstrap.leaf),
          siblings: body.utxoBootstrap.siblings.map(Field.from),
        },
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
