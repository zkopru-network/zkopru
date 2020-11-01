import { TransactionObject } from '@zkopru/contracts'
import { logger } from '@zkopru/utils'
import { TransactionConfig } from 'web3-core'
import { L1Contract } from '../../context/layer1'
import { OnchainValidation } from '../types'

export class OnchainValidatorContext {
  layer1: L1Contract

  constructor(layer1: L1Contract) {
    this.layer1 = layer1
  }

  async isSlashable(
    tx: TransactionObject<{
      slash: boolean
      reason: string
      0: boolean
      1: string
    }>,
    config?: TransactionConfig,
  ): Promise<OnchainValidation> {
    let slashable = false
    try {
      await this.layer1.web3.eth.call({
        ...config,
        to: this.layer1.address,
        data: tx.encodeABI(),
      })
      slashable = true
      // const estimatedGas = await this.layer1.web3.eth.estimateGas(
      //   {
      //     to: this.layer1.address,
      //     data: tx.encodeABI(),
      //   },
      //   (err, gas) => {
      //     console.log(err)
      //     // eslint-disable-next-line dot-notation
      //     console.log(`estimated gas-${tx['_method'].name}:`, gas)
      //   },
      // )
      // // eslint-disable-next-line dot-notation
      // console.log(`estimated gas-${tx['_method'].name}:`, estimatedGas)
    } catch (err) {
      logger.debug('slash call reverted', err)
      slashable = false
    }
    return {
      tx,
      slashable,
    }
  }
}
