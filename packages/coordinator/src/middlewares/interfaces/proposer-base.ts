import { Block } from '@zkopru/core'
import { TransactionReceipt } from '@ethersproject/providers'
import { CoordinatorContext } from '../../context'

export abstract class ProposerBase {
  context: CoordinatorContext

  private preProcessor?:
    | ((block: Block) => Promise<Block | undefined> | Block | undefined)
    | null

  private postProcessor?: ((recipt: TransactionReceipt) => Promise<void>) | null

  constructor(context: CoordinatorContext) {
    this.context = context
  }

  setPreProcessor(
    processor: (block: Block) => Promise<Block | undefined> | Block | undefined,
  ) {
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
    if (!preprocessed) return
    const receipt = await this.handleProcessedBlock(preprocessed)
    if (this.postProcessor && receipt?.status) {
      await this.postProcessor(receipt)
    }
    return receipt
  }

  protected abstract handleProcessedBlock(
    block: Block,
  ): Promise<TransactionReceipt | undefined>
}
