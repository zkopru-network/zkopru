import { logger } from '@zkopru/utils'
import { Validation, ValidateFnCalls } from '../../validator/types'
import { ValidatorBase as Validator } from '../../validator'
import { Block, Header } from '../../block'

export class FullValidator extends Validator {
  async validate(parent: Header, block: Block): Promise<Validation> {
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
      fnCalls.map(fnCall => {
        const result = offchainValidator[fnCall.name]
          .call(offchainValidator, ...fnCall.args)
          .catch(err => {
            if (err instanceof Error) {
              logger.error(
                `core/fullnode-validator - offchain validation error: ${
                  fnCall.name
                }(${JSON.stringify(fnCall.args)}): ${err.toString()}`,
              )
            }
            return { slashable: false, err }
          })
        return result
      }),
    )

    for (const result of offchainResult.filter(result => !!result.slashable)) {
      logger.warn(
        `core/fullnode-validator - offchain validation failed: ${result.reason}`,
      )
    }
    const onchainResult: Validation[] = await Promise.all(
      fnCalls.map(fnCall => {
        const result = onchainValidator[fnCall.name]
          .call(onchainValidator, ...fnCall.args)
          .catch(err => {
            if (err instanceof Error) {
              logger.error(
                `core/fullnode-validator - onchain validation error: ${
                  fnCall.name
                }(${JSON.stringify(fnCall.args)}): ${err.toString()}`,
              )
            }
            return { slashable: false, err }
          })
        return result
      }),
    )
    if (
      offchainResult.every(
        (result, index) =>
          result.slashable === onchainResult[index].slashable &&
          result.slashable === false,
      )
    ) {
      // every result says the block is a valid one.
      return { slashable: false }
    }
    const onchainFailure = onchainResult.find(res => res.slashable === true)
    if (onchainFailure) {
      return onchainFailure
    }
    const offchainError = offchainResult.find(res => !!(res as any).err)
    if (offchainError) throw (offchainError as any).err
    const offchainFailure = offchainResult.find(res => res.slashable === true)
    if (offchainFailure) {
      return offchainFailure
    }
    throw Error('Unknown validation error')
  }
}
