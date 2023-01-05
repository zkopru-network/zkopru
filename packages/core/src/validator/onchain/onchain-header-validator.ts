import { BlockData, HeaderValidator, Validation } from '../types'
import { blockDataToHexString } from '../utils'
import { OnchainValidatorContext } from './onchain-context'

export class OnchainHeaderValidator extends OnchainValidatorContext
  implements HeaderValidator {
  async validateDepositRoot(block: BlockData): Promise<Validation> {
    const tx = await this.layer1.validators.header.populateTransaction.validateDepositRoot(
      blockDataToHexString(block),
    )
    const result = await this.isSlashable(tx, 'DepositRoot')
    return result
  }

  async validateTxRoot(block: BlockData): Promise<Validation> {
    const tx = await this.layer1.validators.header.populateTransaction.validateTxRoot(
      blockDataToHexString(block),
    )
    const result = await this.isSlashable(tx, 'TxRoot')
    return result
  }

  async validateMigrationRoot(block: BlockData): Promise<Validation> {
    const tx = await this.layer1.validators.header.populateTransaction.validateMigrationRoot(
      blockDataToHexString(block),
    )
    const result = await this.isSlashable(tx, 'MigrationRoot')
    return result
  }

  async validateTotalFee(block: BlockData): Promise<Validation> {
    const tx = await this.layer1.validators.header.populateTransaction.validateTotalFee(
      blockDataToHexString(block),
    )
    const result = await this.isSlashable(tx, 'TotalFee')
    return result
  }

  async validateParentBlock(block: BlockData): Promise<Validation> {
    const tx = await this.layer1.validators.header.populateTransaction.validateParentBlock(
      blockDataToHexString(block),
    )
    const result = await this.isSlashable(tx, 'ParentBlock')
    return result
  }
}
