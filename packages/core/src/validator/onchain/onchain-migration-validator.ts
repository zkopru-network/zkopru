import { Uint256 } from 'soltypes'
import { BlockData, MigrationValidator, OnchainValidation } from '../types'
import { blockDataToHexString } from '../utils'
import { OnchainValidatorContext } from './onchain-context'

export class OnchainMigrationValidator extends OnchainValidatorContext
  implements MigrationValidator {
  async validateDuplicatedDestination(
    block: BlockData,
    migrationIndex1: Uint256,
    migrationIndex2: Uint256,
  ): Promise<OnchainValidation> {
    const tx = this.layer1.validators.migration.methods.validateDuplicatedDestination(
      blockDataToHexString(block),
      migrationIndex1.toString(),
      migrationIndex2.toString(),
    )
    const result = await this.isSlashable(tx)
    return result
  }

  async validateTotalEth(
    block: BlockData,
    migrationIndex: Uint256,
  ): Promise<OnchainValidation> {
    const tx = this.layer1.validators.migration.methods.validateTotalEth(
      blockDataToHexString(block),
      migrationIndex.toString(),
    )
    const result = await this.isSlashable(tx)
    return result
  }

  async validateMergedLeaves(
    block: BlockData,
    migrationIndex: Uint256,
  ): Promise<OnchainValidation> {
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
  ): Promise<OnchainValidation> {
    const tx = this.layer1.validators.migration.methods.validateMigrationFee(
      blockDataToHexString(block),
      migrationIndex.toString(),
    )
    const result = await this.isSlashable(tx)
    return result
  }

  async validateDuplicatedERC20Migration(
    block: BlockData,
    migrationIndex: Uint256,
    erc20Idx1: Uint256,
    erc20Idx2: Uint256,
  ): Promise<OnchainValidation> {
    const tx = this.layer1.validators.migration.methods.validateDuplicatedERC20Migration(
      blockDataToHexString(block),
      migrationIndex.toString(),
      erc20Idx1.toString(),
      erc20Idx2.toString(),
    )
    const result = await this.isSlashable(tx)
    return result
  }

  async validateERC20Amount(
    block: BlockData,
    migrationIndex: Uint256,
    erc20Idx: Uint256,
  ): Promise<OnchainValidation> {
    const tx = this.layer1.validators.migration.methods.validateERC20Amount(
      blockDataToHexString(block),
      migrationIndex.toString(),
      erc20Idx.toString(),
    )
    const result = await this.isSlashable(tx)
    return result
  }

  async validateDuplicatedERC721Migration(
    block: BlockData,
    migrationIndex: Uint256,
    erc721Idx1: Uint256,
    erc721Idx2: Uint256,
  ): Promise<OnchainValidation> {
    const tx = this.layer1.validators.migration.methods.validateDuplicatedERC721Migration(
      blockDataToHexString(block),
      migrationIndex.toString(),
      erc721Idx1.toString(),
      erc721Idx2.toString(),
    )
    const result = await this.isSlashable(tx)
    return result
  }

  async validateNonFungibility(
    block: BlockData,
    migrationIndex: Uint256,
    erc721Idx: Uint256,
    tokenId: Uint256,
  ): Promise<OnchainValidation> {
    const tx = this.layer1.validators.migration.methods.validateNonFungibility(
      blockDataToHexString(block),
      migrationIndex.toString(),
      erc721Idx.toString(),
      tokenId.toString(),
    )
    const result = await this.isSlashable(tx)
    return result
  }

  async validateNftExistence(
    block: BlockData,
    migrationIndex: Uint256,
    erc721Idx: Uint256,
    tokenId: Uint256,
  ): Promise<OnchainValidation> {
    const tx = this.layer1.validators.migration.methods.validateNftExistence(
      blockDataToHexString(block),
      migrationIndex.toString(),
      erc721Idx.toString(),
      tokenId.toString(),
    )
    const result = await this.isSlashable(tx)
    return result
  }
}
