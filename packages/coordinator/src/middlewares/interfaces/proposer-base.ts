import { Block } from '@zkopru/core'
import { TransactionReceipt } from 'web3-core'
import { CoordinatorContext } from '../../context'

export abstract class ProposerBase {
  context: CoordinatorContext

  private preProcessor?: ((block: Block) => Promise<Block> | Block) | null

  constructor(context: CoordinatorContext) {
    this.context = context
  }

  setPreProcessor(processor: (block: Block) => Promise<Block> | Block) {
    this.preProcessor = processor
  }

  removePreProcessor() {
    this.preProcessor = null
  }

  async propose(block: Block): Promise<TransactionReceipt | undefined> {
    const preprocessed = this.preProcessor
      ? await this.preProcessor(block)
      : block
    const result = await this.handleProcessedBlock(preprocessed)
    return result
  }

  protected abstract handleProcessedBlock(
    block: Block,
  ): Promise<TransactionReceipt | undefined>
}
