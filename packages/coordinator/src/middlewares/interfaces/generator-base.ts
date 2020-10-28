import { Block } from '@zkopru/core'
import { CoordinatorContext } from '../../context'

export abstract class GeneratorBase {
  context: CoordinatorContext

  constructor(context: CoordinatorContext) {
    this.context = context
  }

  abstract async genBlock(): Promise<Block>
}
