import { L1Contract } from '../../layer1'
import {
  BlockValidator,
  DepositValidator,
  HeaderValidator,
  MigrationValidator,
  NullifierTreeValidator,
  TxSNARKValidator,
  TxValidator,
  UtxoTreeValidator,
  WithdrawalTreeValidator,
} from '../types'
import { OnchainDepositValidator } from './onchain-deposit-validator'
import { OnchainHeaderValidator } from './onchain-header-validator'
import { OnchainMigrationValidator } from './onchain-migration-validator'
import { OnchainNullifierTreeValidator } from './onchain-nullifier-tree-validator'
import { OnchainTxSNARKValidator } from './onchain-snark-validator'
import { OnchainTxValidator } from './onchain-tx-validator'
import { OnchainUtxoTreeValidator } from './onchain-utxo-tree-validator'
import { OnchainWithdrawalTreeValidator } from './onchain-withdrawal-tree-nullifier'

export class OnchainValidator implements BlockValidator {
  deposit: DepositValidator

  header: HeaderValidator

  migration: MigrationValidator

  utxoTree: UtxoTreeValidator

  withdrawalTree: WithdrawalTreeValidator

  nullifierTree: NullifierTreeValidator

  tx: TxValidator

  snark: TxSNARKValidator

  constructor(layer1: L1Contract) {
    this.deposit = new OnchainDepositValidator(layer1)
    this.header = new OnchainHeaderValidator(layer1)
    this.migration = new OnchainMigrationValidator(layer1)
    this.utxoTree = new OnchainUtxoTreeValidator(layer1)
    this.nullifierTree = new OnchainNullifierTreeValidator(layer1)
    this.withdrawalTree = new OnchainWithdrawalTreeValidator(layer1)
    this.tx = new OnchainTxValidator(layer1)
    this.snark = new OnchainTxSNARKValidator(layer1)
  }
}
