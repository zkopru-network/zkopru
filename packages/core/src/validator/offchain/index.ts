import { L2Chain } from '../../context/layer2'
import {
  BlockValidator,
  DepositValidator,
  HeaderValidator,
  MigrationValidator,
  NullifierTreeValidator,
  TxValidator,
  UtxoTreeValidator,
  WithdrawalTreeValidator,
} from '../types'
import { OffchainDepositValidator } from './offchain-deposit-validator'
import { OffchainHeaderValidator } from './offchain-header-validator'
import { OffchainMigrationValidator } from './offchain-migration-validator'
import { OffchainNullifierTreeValidator } from './offchain-nullifier-tree-validator'
import { OffchainTxValidator } from './offchain-tx-validator'
import { OffchainUtxoTreeValidator } from './offchain-utxo-tree-validator'
import { OffchainWithdrawalTreeValidator } from './offchain-withdrawal-tree-validator'

export class OffchainValidator implements BlockValidator {
  deposit: DepositValidator

  header: HeaderValidator

  migration: MigrationValidator

  utxoTree: UtxoTreeValidator

  withdrawalTree: WithdrawalTreeValidator

  nullifierTree: NullifierTreeValidator

  tx: TxValidator

  constructor(layer2: L2Chain) {
    this.deposit = new OffchainDepositValidator(layer2)
    this.header = new OffchainHeaderValidator(layer2)
    this.migration = new OffchainMigrationValidator(layer2)
    this.utxoTree = new OffchainUtxoTreeValidator(layer2)
    this.nullifierTree = new OffchainNullifierTreeValidator(layer2)
    this.withdrawalTree = new OffchainWithdrawalTreeValidator(layer2)
    this.tx = new OffchainTxValidator(layer2)
  }
}
