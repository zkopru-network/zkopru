import { logger } from '@zkopru/utils'
import { Validation, ChallengeTx, ValidateFnCalls } from '../../validator/types'
import { ValidatorBase as Validator } from '../../validator'
import { Block, Header } from '../../block'

export class LightValidator extends Validator {
  async validate(
    parent: Header,
    block: Block,
  ): Promise<ChallengeTx | undefined> {
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
      fnCalls.map(fnCall => offchainValidator[fnCall.name](...fnCall.args)),
    )
    const slashableCallIndex = offchainResult.findIndex(
      result => result.slashable,
    )
    if (slashableCallIndex < 0) {
      // not exists
      return undefined
    }
    const fnCall = fnCalls[slashableCallIndex]
    const result = await onchainValidator[fnCall.name](...fnCall.args)
    if (result) {
      logger.warn('Challenge exists')
      // Do not send challenge tx to save gas.
      // TODO give option to send challenge tx also in the light node.
      // return result.tx
    }
    return undefined
  }
}
