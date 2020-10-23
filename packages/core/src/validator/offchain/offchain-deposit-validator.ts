import { Uint256 } from 'soltypes'
import { CODE } from '../code'
import { BlockData, DepositValidator, Slash } from '../types'
import { blockDataToBlock } from '../utils'
import { OffchainValidatorContext } from './offchain-context'

export class OffchainDepositValidator extends OffchainValidatorContext
  implements DepositValidator {
  async validateMassDeposit(data: BlockData, index: Uint256): Promise<Slash> {
    const block = blockDataToBlock(data)
    const migration = block.body.massDeposits[index.toBN().toNumber()]
    const storedMigration = await this.layer2.getDeposits(migration)
    return {
      slashable: storedMigration.length === 0,
      reason: CODE.D1,
    }
  }
}
