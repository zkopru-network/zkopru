import { challengeCodeToString } from '../code'
import { BlockData, HeaderValidator, Slash } from '../types'
import { blockDataToHexString } from '../utils'
import { OnchainValidatorContext } from './onchain-context'

export class OnchainHeaderValidator extends OnchainValidatorContext
  implements HeaderValidator {
  async validateDepositRoot(block: BlockData): Promise<Slash> {
    const tx = this.layer1.validators.header.methods.validateDepositRoot(
      blockDataToHexString(block),
    )
    const result = await tx.call()
    const slash: Slash = {
      slashable: result.slash,
      reason: challengeCodeToString(result.reason),
    }
    return slash
  }

  async validateTxRoot(block: BlockData): Promise<Slash> {
    const tx = this.layer1.validators.header.methods.validateTxRoot(
      blockDataToHexString(block),
    )
    const result = await tx.call()
    const slash: Slash = {
      slashable: result.slash,
      reason: challengeCodeToString(result.reason),
    }
    return slash
  }

  async validateMigrationRoot(block: BlockData): Promise<Slash> {
    const tx = this.layer1.validators.header.methods.validateMigrationRoot(
      blockDataToHexString(block),
    )
    const result = await tx.call()
    const slash: Slash = {
      slashable: result.slash,
      reason: challengeCodeToString(result.reason),
    }
    return slash
  }

  async validateTotalFee(block: BlockData): Promise<Slash> {
    const tx = this.layer1.validators.header.methods.validateTotalFee(
      blockDataToHexString(block),
    )
    const result = await tx.call()
    const slash: Slash = {
      slashable: result.slash,
      reason: challengeCodeToString(result.reason),
    }
    return slash
  }

  async validateParentBlock(block: BlockData): Promise<Slash> {
    const tx = this.layer1.validators.header.methods.validateParentBlock(
      blockDataToHexString(block),
    )
    const result = await tx.call()
    const slash: Slash = {
      slashable: result.slash,
      reason: challengeCodeToString(result.reason),
    }
    return slash
  }
}
