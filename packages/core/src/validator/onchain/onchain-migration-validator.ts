import { Uint256 } from 'soltypes'
import { BlockData, MigrationValidator, Validation } from '../types'
import { blockDataToHexString } from '../utils'
import { OnchainValidatorContext } from './onchain-context'

export class OnchainMigrationValidator extends OnchainValidatorContext
  implements MigrationValidator {
  async validateDuplicatedMigrations(
    block: BlockData,
    migrationIndex1: Uint256,
    migrationIndex2: Uint256,
  ): Promise<Validation> {
    const tx = this.layer1.validators.migration.methods.validateDuplicatedMigrations(
      blockDataToHexString(block),
      migrationIndex1.toString(),
      migrationIndex2.toString(),
    )
    const result = await this.isSlashable(tx)
    return result
  }

  async validateEthMigration(
    block: BlockData,
    migrationIndex: Uint256,
  ): Promise<Validation> {
    const tx = this.layer1.validators.migration.methods.validateEthMigration(
      blockDataToHexString(block),
      migrationIndex.toString(),
    )
    const result = await this.isSlashable(tx)
    return result
  }

  async validateERC20Migration(
    block: BlockData,
    migrationIndex: Uint256,
  ): Promise<Validation> {
    const tx = this.layer1.validators.migration.methods.validateERC20Migration(
      blockDataToHexString(block),
      migrationIndex.toString(),
    )
    const result = await this.isSlashable(tx)
    return result
  }

  async validateMergedLeaves(
    block: BlockData,
    migrationIndex: Uint256,
  ): Promise<Validation> {
    const tx = this.layer1.validators.migration.methods.validateMergedLeaves(
      blockDataToHexString(block),
      migrationIndex.toString(),
    )
    const result = await this.isSlashable(tx)
    return result
  }

  async validateMigrationFee(
    block: BlockData,
    migrationIndex: Uint256,
  ): Promise<Validation> {
    const tx = this.layer1.validators.migration.methods.validateMigrationFee(
      blockDataToHexString(block),
      migrationIndex.toString(),
    )
    const result = await this.isSlashable(tx)
    return result
  }

  async validateTokenRegistration(
    block: BlockData,
    migrationIndex: Uint256,
  ): Promise<Validation> {
    const tx = this.layer1.validators.migration.methods.validateTokenRegistration(
      blockDataToHexString(block),
      migrationIndex.toString(),
    )
    const result = await this.isSlashable(tx)
    return result
  }

  async validateMissedMassMigration(
    block: BlockData,
    txIndex: Uint256,
    outflowIndex: Uint256,
  ): Promise<Validation> {
    const tx = this.layer1.validators.migration.methods.validateMissedMassMigration(
      blockDataToHexString(block),
      txIndex.toString(),
      outflowIndex.toString(),
    )
    const result = await this.isSlashable(tx)
    return result
  }
}
