import { TransactionObject } from '@zkopru/contracts'
import { BlockProcessor } from '../block-processor'
import { Block, Header } from '../../block'

export class LightNodeBlockProcessor extends BlockProcessor {
  async validate(
    parent: Header,
    block: Block,
  ): Promise<TransactionObject<{
    slash: boolean
    reason: string
    0: boolean
    1: string
  }> | null> {
    const test = { a: this, parent, block }
    if (test) {
      console.log('validate a block')
    }
    // const offchainValidations = []
    // const slash = await this.validators.onchain.header.validateDepositRoot(block)
    // if (slash.slashable) {
    //   return
    // }
    return null
  }
}
