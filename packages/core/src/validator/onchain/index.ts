import { L1Contract } from '../../context/layer1'
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
import { OnchainDepositValidator } from './onchain-deposit-validator'
import { OnchainHeaderValidator } from './onchain-header-validator'
import { OnchainMigrationValidator } from './onchain-migration-validator'
import { OnchainNullifierTreeValidator } from './onchain-nullifier-tree-validator'
import { OnchainTxValidator } from './onchain-tx-validator'
import { OnchainUtxoTreeValidator } from './onchain-utxo-tree-validator'
import { OnchainWithdrawalTreeValidator } from './onchain-withdrawal-tree-validator'

export class OnchainValidator implements BlockValidator {
  deposit: DepositValidator

  header: HeaderValidator

  migration: MigrationValidator

  utxoTree: UtxoTreeValidator

  withdrawalTree: WithdrawalTreeValidator

  nullifierTree: NullifierTreeValidator

  tx: TxValidator

  constructor(layer1: L1Contract) {
    this.deposit = new OnchainDepositValidator(layer1)
    this.header = new OnchainHeaderValidator(layer1)
    this.migration = new OnchainMigrationValidator(layer1)
    this.utxoTree = new OnchainUtxoTreeValidator(layer1)
    this.nullifierTree = new OnchainNullifierTreeValidator(layer1)
    this.withdrawalTree = new OnchainWithdrawalTreeValidator(layer1)
    this.tx = new OnchainTxValidator(layer1)
  }
}
