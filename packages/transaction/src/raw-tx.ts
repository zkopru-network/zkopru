import { Fp } from '@zkopru/babyjubjub'
import { Utxo } from './utxo'
import { Outflow } from './outflow'

export interface RawTx {
  inflow: Utxo[]
  outflow: Outflow[]
  swap?: Fp
  fee: Fp
}
