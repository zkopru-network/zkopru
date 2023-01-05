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
    const tx = await this.layer1.validators.migration.populateTransaction.validateDuplicatedMigrations(
      blockDataToHexString(block),
      migrationIndex1.toBigNumber(),
      migrationIndex2.toBigNumber(),
    )
    const result = await this.isSlashable(tx, 'DuplicatedMigrations')
    return result
  }

  async validateEthMigration(
    block: BlockData,
    migrationIndex: Uint256,
  ): Promise<Validation> {
    const tx = await this.layer1.validators.migration.populateTransaction.validateEthMigration(
      blockDataToHexString(block),
      migrationIndex.toBigNumber(),
    )
    const result = await this.isSlashable(tx, 'EthMigration')
    return result
  }

  async validateERC20Migration(
    block: BlockData,
    migrationIndex: Uint256,
  ): Promise<Validation> {
    const tx = await this.layer1.validators.migration.populateTransaction.validateERC20Migration(
      blockDataToHexString(block),
      migrationIndex.toBigNumber(),
    )
    const result = await this.isSlashable(tx, 'ERC20Migration')
    return result
  }

  async validateMergedLeaves(
    block: BlockData,
    migrationIndex: Uint256,
  ): Promise<Validation> {
    const tx = await this.layer1.validators.migration.populateTransaction.validateMergedLeaves(
      blockDataToHexString(block),
      migrationIndex.toBigNumber(),
    )
    const result = await this.isSlashable(tx, 'MergedLeaves')
    return result
  }

  async validateMigrationFee(
    block: BlockData,
    migrationIndex: Uint256,
  ): Promise<Validation> {
    const tx = await this.layer1.validators.migration.populateTransaction.validateMigrationFee(
      blockDataToHexString(block),
      migrationIndex.toBigNumber(),
    )
    const result = await this.isSlashable(tx, 'MigrationFee')
    return result
  }

  async validateTokenRegistration(
    block: BlockData,
    migrationIndex: Uint256,
  ): Promise<Validation> {
    const tx = await this.layer1.validators.migration.populateTransaction.validateTokenRegistration(
      blockDataToHexString(block),
      migrationIndex.toBigNumber(),
    )
    const result = await this.isSlashable(tx, 'TokenRegistration')
    return result
  }

  async validateMissedMassMigration(
    block: BlockData,
    txIndex: Uint256,
    outflowIndex: Uint256,
  ): Promise<Validation> {
    const tx = await this.layer1.validators.migration.populateTransaction.validateMissedMassMigration(
      blockDataToHexString(block),
      txIndex.toBigNumber(),
      outflowIndex.toBigNumber(),
    )
    const result = await this.isSlashable(tx, 'MissedMassMigration')
    return result
  }
}
