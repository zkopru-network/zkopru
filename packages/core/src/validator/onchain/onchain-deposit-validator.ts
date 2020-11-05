import { Uint256 } from 'soltypes'
import { BlockData, DepositValidator, OnchainValidation } from '../types'
import { blockDataToHexString } from '../utils'
import { OnchainValidatorContext } from './onchain-context'

export class OnchainDepositValidator extends OnchainValidatorContext
  implements DepositValidator {
  async validateMassDeposit(
    block: BlockData,
    index: Uint256,
  ): Promise<OnchainValidation> {
    const tx = this.layer1.validators.deposit.methods.validateMassDeposit(
      blockDataToHexString(block),
      index.toString(),
    )
    const result = await this.isSlashable(tx)
    return result
  }
}
