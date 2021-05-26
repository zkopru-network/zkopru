import fetch from 'node-fetch'
import { TransactionReceipt } from 'web3-core'

import { Block, serializeBody, serializeHeader } from '@zkopru/core'
import { logger } from '@zkopru/utils'
import { ProposerBase } from '~coordinator'
import { CoordinatorContext } from '~coordinator/context'
import { config } from './config'

// TODO: implement metric
export class TestBlockProposer extends ProposerBase {
  lastProposed: string

  proposedNum: number

  constructor(context: CoordinatorContext) {
    super(context)
    this.lastProposed = config.genesisHash //
    this.proposedNum = 0
  }

  protected async handleProcessedBlock(
    block: Block,
  ): Promise<TransactionReceipt | undefined> {
    if (!this.context.gasPrice) {
      throw Error('coordinator.js: Gas price is not synced')
    }
    const { layer1, layer2 } = this.context.node
    const blocks = await layer2.db.findMany('Header', {
      where: {
        parentBlock: block.header.parentBlock.toString(),
      },
    })
    const blockHashes = blocks.map(({ hash }) => hash)
    const siblingProposals = await layer2.db.findMany('Proposal', {
      where: {
        OR: [
          {
            hash: blockHashes,
            verified: true,
            isUncle: null,
          },
          {
            hash: block.hash.toString(),
          },
        ],
      },
    })
    if (siblingProposals.length > 0) {
      logger.info(`Already proposed for the given parent block`)
      return undefined
    }

    const bytes = Buffer.concat([
      serializeHeader(block.header),
      serializeBody(block.body),
    ])
    const blockData = `0x${bytes.toString('hex')}`
    const proposeTx = layer1.coordinator.methods.propose(blockData)
    let expectedGas: number
    try {
      expectedGas = await proposeTx.estimateGas({
        from: this.context.account.address,
      })
      logger.info(`Propose estimated gas ${expectedGas}`)
      expectedGas = Math.floor(expectedGas * 1.5)
      logger.info(`Make it 50% extra then floor gas ${expectedGas}`)
    } catch (err) {
      logger.warn(`propose() fails. Skip gen block`)
      return undefined
    }
    const expectedFee = this.context.gasPrice.muln(expectedGas)
    if (block.header.fee.toBN().lte(expectedFee)) {
      logger.info(
        `Skip gen block. Aggregated fee is not enough yet ${block.header.fee} / ${expectedFee}`,
      )
      return undefined
    }
    const receipt = await layer1.sendTx(proposeTx, this.context.account, {
      gas: expectedGas,
      gasPrice: this.context.gasPrice.toString(),
    })
    if (receipt) {
      // Additional code for Observattion over `BlockProposer` class
      if (this.lastProposed !== block.hash.toString()) {
        const response = await fetch(`http://organizer:8080/propose`, {
          method: 'post',
          body: JSON.stringify({
            timestamp: Date.now(),
            proposed: this.proposedNum,
            txcount: block.body.txs.length,
          }),
        })
        if (response.status !== 200) {
          logger.warn(`Organizer well not received : ${await response.text()}`)
        }
        this.lastProposed = block.hash.toString()
        this.proposedNum += 1
      }
      logger.info(`Proposed a new block: ${block.hash.toString()}`)
    } else {
      logger.warn(`Failed to propose a new block: ${block.hash.toString()}`)
    }
    return receipt
  }
}
