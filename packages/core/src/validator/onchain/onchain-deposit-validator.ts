import { Uint256 } from 'soltypes'
import { challengeCodeToString } from '../code'
import { BlockData, DepositValidator, Slash } from '../types'
import { blockDataToHexString } from '../utils'
import { OnchainValidatorContext } from './onchain-context'

export class OnchainDepositValidator extends OnchainValidatorContext
  implements DepositValidator {
  async validateMassDeposit(block: BlockData, index: Uint256): Promise<Slash> {
    const tx = this.layer1.validators.deposit.methods.validateMassDeposit(
      blockDataToHexString(block),
      index.toString(),
    )
    const result = await tx.call()
    const slash: Slash = {
      slashable: result.slash,
      reason: challengeCodeToString(result.reason),
    }
    return slash
  }
}
