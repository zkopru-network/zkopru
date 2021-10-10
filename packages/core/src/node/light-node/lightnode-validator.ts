import { logger } from '@zkopru/utils'
import { Validation, ValidateFnCalls } from '../../validator/types'
import { ValidatorBase as Validator } from '../../validator'
import { Block, Header } from '../../block'

export class LightValidator extends Validator {
  async validate(parent: Header, block: Block): Promise<Validation> {
    const validateFns = [
      this.validateHeader,
      this.validateMassDeposit,
      this.validateMassMigration,
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
    const logTime = false
    if (logTime) console.time(`validate`)
    const validationResults = await Promise.all(
      validationCalls.map(async calls => {
        const result = await this.executeValidateFnCalls(calls)
        return result
      }),
    )
    if (logTime) console.timeEnd(`validate`)
    const validationFailure = validationResults.find(
      result => result.slashable === true,
    )
    return validationFailure || { slashable: false }
  }

  // eslint-disable-next-line class-methods-use-this
  protected async executeValidateFnCalls({
    onchainValidator,
    offchainValidator,
    fnCalls,
  }: ValidateFnCalls): Promise<Validation> {
    const offchainResult: Validation[] = await Promise.all(
      fnCalls.map(fnCall => offchainValidator[fnCall.name](...fnCall.args)),
    )
    const slashableCallIndex = offchainResult.findIndex(
      result => result.slashable,
    )
    if (slashableCallIndex < 0) {
      // not exists
      return {
        slashable: false,
      }
    }
    const fnCall = fnCalls[slashableCallIndex]
    const result = await onchainValidator[fnCall.name](...fnCall.args)
    if (result) {
      logger.warn(`core/lightnode-validator - Challenge exists`)
      // Do not send challenge tx to save gas.
      // TODO give option to send challenge tx also in the light node.
      // return result.tx
    }
    return {
      slashable: true,
    }
  }
}
