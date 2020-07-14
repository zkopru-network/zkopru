import { Field } from '@zkopru/babyjubjub'
import { Utxo } from './utxo'
import { Outflow } from './outflow'

export interface RawTx {
  inflow: Utxo[]
  outflow: Outflow[]
  swap?: Field
  fee: Field
}
