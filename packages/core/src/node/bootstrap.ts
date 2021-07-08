import fetch from 'node-fetch'
import { MerkleProof } from '@zkopru/tree'
import { Fp } from '@zkopru/babyjubjub'
import BN from 'bn.js'
import { Proposal } from '@zkopru/database'
import { logger } from '@zkopru/utils'

export interface BootstrapData {
  proposal: Proposal
  blockHash: string
  utxoStartingLeafProof: MerkleProof<Fp>
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
      logger.debug(`body ${response.body}`)
      return {
        proposal: body.proposal,
        blockHash: body.blockHash,
        utxoStartingLeafProof: {
          root: Fp.from(body.utxoBootstrap.root),
          index: Fp.from(body.utxoBootstrap.index),
          leaf: Fp.from(body.utxoBootstrap.leaf),
          siblings: body.utxoBootstrap.siblings.map(Fp.from),
        },
        withdrawalStartingLeafProof: {
          root: Fp.from(body.withdrawalBootstrap.root),
          index: Fp.from(body.withdrawalBootstrap.index),
          leaf: Fp.from(body.withdrawalBootstrap.leaf),
          siblings: body.withdrawalBootstrap.siblings.map(Fp.from),
        },
      }
    }
    throw Error(`${await response.text()}`)
  }
}
