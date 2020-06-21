import { Withdrawal } from './withdrawal'
import { Utxo } from './utxo'
import { Migration } from './migration'

export type Outflow = Utxo | Withdrawal | Migration
