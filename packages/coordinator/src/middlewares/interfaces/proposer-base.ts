import { Block } from '@zkopru/core'
import { TransactionReceipt } from 'web3-core'
import { CoordinatorContext } from '../../context'

export abstract class ProposerBase {
  context: CoordinatorContext

  private preProcessor?: ((block: Block) => Promise<Block> | Block) | null

  private postProcessor?: ((recipt: TransactionReceipt) => Promise<void>) | null

  constructor(context: CoordinatorContext) {
    this.context = context
  }

  setPreProcessor(processor: (block: Block) => Promise<Block> | Block) {
    this.preProcessor = processor
  }

  setPostProcessor(processor: (receipt: TransactionReceipt) => Promise<void>) {
    this.postProcessor = processor
  }

  removePreProcessor() {
    this.preProcessor = null
  }

  removePostProcessor() {
    this.postProcessor = null
  }

  async propose(block: Block): Promise<TransactionReceipt | undefined> {
    const preprocessed = this.preProcessor
      ? await this.preProcessor(block)
      : block
    const result = await this.handleProcessedBlock(preprocessed)
    if (this.postProcessor && result?.status) {
      await this.postProcessor(result)
    }
    return result
  }

  protected abstract handleProcessedBlock(
    block: Block,
  ): Promise<TransactionReceipt | undefined>
}
