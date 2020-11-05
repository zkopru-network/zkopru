import { BlockData, HeaderValidator, OnchainValidation } from '../types'
import { blockDataToHexString } from '../utils'
import { OnchainValidatorContext } from './onchain-context'

export class OnchainHeaderValidator extends OnchainValidatorContext
  implements HeaderValidator {
  async validateDepositRoot(block: BlockData): Promise<OnchainValidation> {
    const tx = this.layer1.validators.header.methods.validateDepositRoot(
      blockDataToHexString(block),
    )
    const result = await this.isSlashable(tx)
    return result
  }

  async validateTxRoot(block: BlockData): Promise<OnchainValidation> {
    const tx = this.layer1.validators.header.methods.validateTxRoot(
      blockDataToHexString(block),
    )
    const result = await this.isSlashable(tx)
    return result
  }

  async validateMigrationRoot(block: BlockData): Promise<OnchainValidation> {
    const tx = this.layer1.validators.header.methods.validateMigrationRoot(
      blockDataToHexString(block),
    )
    const result = await this.isSlashable(tx)
    return result
  }

  async validateTotalFee(block: BlockData): Promise<OnchainValidation> {
    const tx = this.layer1.validators.header.methods.validateTotalFee(
      blockDataToHexString(block),
    )
    const result = await this.isSlashable(tx)
    return result
  }

  async validateParentBlock(block: BlockData): Promise<OnchainValidation> {
    const tx = this.layer1.validators.header.methods.validateParentBlock(
      blockDataToHexString(block),
    )
    const result = await this.isSlashable(tx)
    return result
  }
}
