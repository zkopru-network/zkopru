import { logger } from '@zkopru/utils'
import {
  OnchainValidation,
  Validation,
  ChallengeTx,
  ValidateFnCalls,
} from '../../validator/types'
import { ValidatorBase as Validator } from '../../validator'
import { Block, Header } from '../../block'

export class FullValidator extends Validator {
  async validate(
    parent: Header,
    block: Block,
  ): Promise<ChallengeTx | undefined> {
    const validateFns = [
      this.validateHeader,
      this.validateMassDeposit,
      this.validateMassMigration,
      this.validateNullifierTree,
      this.validateUtxoTree,
      this.validateWithdrawalTree,
      this.validateTx,
    ]
    const validationCalls = await Promise.all(
      validateFns.map(async fn => {
        const calls = await fn.call(this, block, parent)
        return calls
      }),
    )
    const logTime = true
    if (logTime) console.time(`validate`)
    const validationResults = await Promise.all(
      validationCalls.map(async calls => {
        const challengeTx = await this.executeValidateFnCalls(calls)
        if (challengeTx !== undefined) {
          return challengeTx
        }
        return undefined
      }),
    )
    if (logTime) console.timeEnd(`validate`)
    return validationResults.find(result => result !== undefined)
  }

  // eslint-disable-next-line class-methods-use-this
  protected async executeValidateFnCalls({
    onchainValidator,
    offchainValidator,
    fnCalls,
  }: ValidateFnCalls): Promise<ChallengeTx | undefined> {
    const offchainResult: Validation[] = await Promise.all(
      fnCalls.map(fnCall => {
        const result = offchainValidator[fnCall.name].call(
          offchainValidator,
          ...fnCall.args,
        )
        return result
      }),
    )
    for (const result of offchainResult.filter(result => result.slashable)) {
      logger.warn(`challenge: ${result.reason}`)
    }
    const onchainResult: OnchainValidation[] = await Promise.all(
      fnCalls.map(fnCall => {
        const result = onchainValidator[fnCall.name].call(
          onchainValidator,
          ...fnCall.args,
        )
        return result
      }),
    )
    if (
      !offchainResult.every(
        (result, index) => result.slashable === onchainResult[index].slashable,
      )
    ) {
      onchainResult.forEach((result, index) => {
        if (result.slashable !== offchainResult[index].slashable) {
          console.log('onchain', onchainResult[index])
          console.log('offchain', offchainResult[index])
        }
      })
      logger.error(
        'Offchain validation and onchain validation is showing different results',
      )
    }
    return onchainResult.find(res => res.slashable)?.tx
  }
}
