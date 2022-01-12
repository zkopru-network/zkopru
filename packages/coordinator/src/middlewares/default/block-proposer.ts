/* eslint-disable no-underscore-dangle */
import { Block, MAX_MASS_DEPOSIT_COMMIT_GAS } from '@zkopru/core'
import { TransactionReceipt } from 'web3-core'
import { soliditySha3Raw } from 'web3-utils'
import { logger } from '@zkopru/utils'
import { ProposerBase } from '../interfaces/proposer-base'

export class BlockProposer extends ProposerBase {
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
            isUncle: false,
          },
          {
            hash: block.hash.toString(),
          },
        ],
      },
    })
    if (siblingProposals.length > 0) {
      logger.info(
        `core/block-proposer.ts - Proposal exists for the given height`,
      )
      return undefined
    }

    const parentProposal = await layer2.db.findOne('Proposal', {
      where: {
        hash: block.header.parentBlock.toString(),
      },
    })
    if (!parentProposal) {
      throw new Error('Unable to find parent proposal')
    }
    if (!parentProposal.proposalData && parentProposal.proposalNum !== 0) {
      throw new Error('No proposal data for parent block')
    }
    const bytes = block.serializeBlock()
    const blockData = `0x${bytes.toString('hex')}`
    let proposeTx: any
    if (parentProposal.proposalNum === 0) {
      // don't safe propose from genesis block
      proposeTx = layer1.coordinator.methods.propose(blockData)
    } else {
      const parentBlock = Block.fromJSON(parentProposal.proposalData)
      proposeTx = layer1.coordinator.methods.safePropose(
        blockData,
        parentBlock.hash.toString(),
        block.body.massDeposits.map(({ merged, fee }) => {
          return soliditySha3Raw(merged.toString(), fee.toBN())
        }),
      )
    }
    let expectedGas: number
    try {
      expectedGas = await proposeTx.estimateGas({
        from: this.context.account.address,
      })
      expectedGas *= 2
      expectedGas += MAX_MASS_DEPOSIT_COMMIT_GAS
    } catch (err) {
      logger.warn(`core/block-proposer.ts - propose() fails. Skip gen block`)
      if (typeof err.toString === 'function') {
        logger.info(`core/block-proposer - ${err.toString()}`)
      }
      return undefined
    }
    const expectedFee = this.context.gasPrice.muln(expectedGas)
    if (block.header.fee.toBN().lte(expectedFee)) {
      logger.info(
        `core/block-proposer.ts - Aggregated fee: ${block.header.fee} / ${expectedFee}`,
      )
      return undefined
    }
    const receipt = await layer1.sendTx(proposeTx, this.context.account, {
      gas: expectedGas,
      gasPrice: this.context.gasPrice.toString(),
    })
    if (receipt) {
      logger.info(
        `core/block-proposer.ts - safePropose(${block.hash.toString()}) completed`,
      )
    } else {
      logger.warn(
        `core/block-proposer.ts - safePropose(${block.hash.toString()}) failed`,
      )
    }
    return receipt
  }
}
