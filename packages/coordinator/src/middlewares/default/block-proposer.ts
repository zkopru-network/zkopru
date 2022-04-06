/* eslint-disable no-underscore-dangle */
import { Block, MAX_MASS_DEPOSIT_COMMIT_GAS } from '@zkopru/core'
import { logger } from '@zkopru/utils'
import { BigNumber, PopulatedTransaction } from 'ethers'
import { solidityKeccak256 } from 'ethers/lib/utils'
import { TransactionReceipt } from '@ethersproject/providers'
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
            isUncle: null,
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
    let proposeTx: PopulatedTransaction
    if (parentProposal.proposalNum === 0) {
      // don't safe propose from genesis block
      proposeTx = await layer1.coordinator.populateTransaction.propose(
        blockData,
      )
    } else {
      const parentBlock = Block.fromJSON(parentProposal.proposalData)
      proposeTx = await layer1.coordinator
        .connect(this.context.account)
        .populateTransaction.safePropose(
          blockData,
          parentBlock.hash.toString(),
          block.body.massDeposits.map(({ merged, fee }) => {
            return solidityKeccak256(
              ['bytes32', 'uint256'],
              [merged.toString(), fee.toBigNumber()],
            )
          }),
        )
    }
    let expectedGas: BigNumber
    try {
      expectedGas = await layer1.provider.estimateGas(proposeTx)
      expectedGas = expectedGas.mul(2)
      expectedGas = expectedGas.add(MAX_MASS_DEPOSIT_COMMIT_GAS)
    } catch (err) {
      logger.warn(`core/block-proposer.ts - propose() fails. Skip gen block`)
      if (err instanceof Error) {
        logger.info(`core/block-proposer - ${err.toString()}`)
      }
      return undefined
    }
    const expectedFee = this.context.gasPrice.mul(expectedGas)
    if (block.header.fee.toBigNumber().lte(expectedFee)) {
      logger.info(
        `core/block-proposer.ts - Aggregated fee: ${block.header.fee} / ${expectedFee}`,
      )
      return undefined
    }
    const signedTx = await this.context.account.signTransaction({
      ...proposeTx,
      nonce: await this.context.account.getTransactionCount('latest'),
      gasLimit: expectedGas,
      gasPrice: this.context.gasPrice,
    })
    const tx = await layer1.provider.sendTransaction(signedTx)
    const receipt = await tx.wait()
    if (receipt.status) {
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
