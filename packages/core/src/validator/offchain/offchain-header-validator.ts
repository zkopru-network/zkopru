/* eslint-disable class-methods-use-this */
import { root } from '@zkopru/utils'
import BN from 'bn.js'
import { massDepositHash, massMigrationHash } from '../../block'
import { CODE } from '../code'
import { BlockData, HeaderValidator, Validation } from '../types'
import { blockDataToBlock } from '../utils'
import { OffchainValidatorContext } from './offchain-context'

export class OffchainHeaderValidator extends OffchainValidatorContext
  implements HeaderValidator {
  async validateDepositRoot(data: BlockData): Promise<Validation> {
    const block = blockDataToBlock(data)
    const slash: Validation = {
      slashable: !block.header.depositRoot.eq(
        root(block.body.massDeposits.map(massDepositHash)),
      ),
      reason: CODE.H1,
    }
    return slash
  }

  async validateTxRoot(data: BlockData): Promise<Validation> {
    const block = blockDataToBlock(data)
    const slash: Validation = {
      slashable: !block.header.txRoot.eq(
        root(block.body.txs.map(tx => tx.hash())),
      ),
      reason: CODE.H2,
    }
    return slash
  }

  async validateMigrationRoot(data: BlockData): Promise<Validation> {
    const block = blockDataToBlock(data)
    const slash: Validation = {
      slashable: !block.header.migrationRoot.eq(
        root(block.body.massMigrations.map(massMigrationHash)),
      ),
      reason: CODE.H3,
    }
    return slash
  }

  async validateTotalFee(data: BlockData): Promise<Validation> {
    const block = blockDataToBlock(data)
    let fee = new BN(0)
    for (const massDeposit of block.body.massDeposits) {
      fee = fee.add(massDeposit.fee.toBN())
    }
    for (const massMigration of block.body.massMigrations) {
      fee = fee.add(massMigration.migratingLeaves.fee.toBN())
    }
    for (const tx of block.body.txs) {
      fee = fee.add(tx.fee)
    }
    const slash: Validation = {
      slashable: !fee.eq(block.header.fee.toBN()),
      reason: CODE.H4,
    }
    return slash
  }

  async validateParentBlock(data: BlockData): Promise<Validation> {
    const block = blockDataToBlock(data)
    const slashed = await this.layer2.db.findOne('Slash', {
      where: {
        hash: block.header.parentBlock.toString(),
      },
    })
    return {
      slashable: slashed !== null && slashed !== undefined,
      reason: CODE.H4,
    }
  }
}
