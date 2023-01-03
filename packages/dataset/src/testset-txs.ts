/* eslint-disable @typescript-eslint/camelcase */
import { Fp } from '@zkopru/babyjubjub'
import { RawTx } from '@zkopru/transaction'
import { utxos } from './testset-utxos'

const tx_1: RawTx = {
  inflow: [utxos.utxo1_in_1],
  outflow: [utxos.utxo1_out_1, utxos.utxo1_out_2],
  fee: Fp.from(1),
}

/** @dev prints DAI */
const tx_1_false: RawTx = {
  inflow: [utxos.utxo1_in_1],
  outflow: [utxos.utxo1_out_1, utxos.utxo1_out_2_false],
  fee: Fp.from(1),
}

const tx_2_1: RawTx = {
  inflow: [utxos.utxo2_1_in_1],
  outflow: [utxos.utxo2_1_out_1, utxos.utxo2_1_out_2],
  swap: utxos.utxo2_2_out_2.hash(),
  fee: Fp.from(1),
}

const tx_2_2: RawTx = {
  inflow: [utxos.utxo2_2_in_1],
  outflow: [utxos.utxo2_2_out_1, utxos.utxo2_2_out_2],
  swap: utxos.utxo2_1_out_2.hash(),
  fee: Fp.from(1),
}

const tx_3: RawTx = {
  inflow: [utxos.utxo3_in_1, utxos.utxo3_in_2, utxos.utxo3_in_3],
  outflow: [utxos.withdrawal3_out_1],
  fee: Fp.from(1),
}

const tx_4: RawTx = {
  inflow: [utxos.utxo4_in_1, utxos.utxo4_in_2, utxos.utxo4_in_3],
  outflow: [utxos.migration_4_1, utxos.migration_4_2, utxos.migration_4_3],
  fee: Fp.from(1),
}

const tx_5_1: RawTx = {
  inflow: [utxos.utxo5_1_in_1],
  outflow: [utxos.utxo5_1_out_1],
  fee: Fp.from(1),
}

const tx_5_2: RawTx = {
  inflow: [utxos.utxo5_2_in_1],
  outflow: [utxos.utxo5_2_out_1, utxos.utxo5_2_out_2],
  fee: Fp.from(1),
}

const tx_5_3: RawTx = {
  inflow: [utxos.utxo5_3_in_1],
  outflow: [utxos.utxo5_3_out_1, utxos.utxo5_3_out_2],
  swap: utxos.utxo5_3_out_2.hash(),
  fee: Fp.from(1),
}

export const txs = {
  tx_1,
  tx_1_false,
  tx_2_1,
  tx_2_2,
  tx_3,
  tx_4,
  tx_5_1,
  tx_5_2,
  tx_5_3,
}
