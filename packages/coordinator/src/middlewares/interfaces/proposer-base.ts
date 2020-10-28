import { Block } from '@zkopru/core'
import { TransactionReceipt } from 'web3-core'
import { CoordinatorContext } from '../../context'

export abstract class ProposerBase {
  context: CoordinatorContext

  constructor(context: CoordinatorContext) {
    this.context = context
  }

  abstract async propose(block: Block): Promise<TransactionReceipt | undefined>
}
