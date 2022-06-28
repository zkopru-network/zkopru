/* eslint dot-notation: ["error", { "allowPattern": "^(_[a-z]+)+$" }] */
import { TransactionRequest } from '@ethersproject/providers'
import { logger } from '@zkopru/utils'
import { L1Contract } from '../../context/layer1'
import { Validation } from '../types'

export class OnchainValidatorContext {
  layer1: L1Contract

  constructor(layer1: L1Contract) {
    this.layer1 = layer1
  }

  async isSlashable(tx: TransactionRequest, methodName?: string): Promise<Validation> {
    let slashable = false
    try {
      await this.layer1.provider.call(tx)
      slashable = true
      const estimatedGas = await this.layer1.provider.estimateGas(tx)
      logger.warn(
        `core/onchain-context.ts - slashable ${methodName ?? 'unknown'}: ${estimatedGas}`,
      )
    } catch (err) {
      logger.trace(
        `core/onchain-context.ts - onchain validation:  ${methodName ?? 'unknown'}(valid)`,
      )
      slashable = false
    }
    return {
      tx,
      slashable,
    }
  }
}
