import { Header, Body } from '@zkopru/core'
import { Field } from '@zkopru/babyjubjub'
import { loadZkTxs } from './testset-zktxs'

function strToField(val: string): Field {
  return Field.fromBuffer(Buffer.from(val))
}

export const dummyHeader: Header = {
  proposer: strToField('proposer').toHex(20),
  parentBlock: strToField('parentBlock').toHex(32),
  metadata: strToField('metadata').toHex(32),
  fee: strToField('totalFee').toHex(32),
  utxoRoot: strToField('utxoRoot').toHex(32),
  utxoIndex: strToField('utxoIndex').toHex(32),
  nullifierRoot: strToField('nullifierRoot').toHex(32),
  withdrawalRoot: strToField('withdrawalRoot').toHex(32),
  withdrawalIndex: strToField('withdrawalIndex').toHex(32),
  txRoot: strToField('txRoot').toHex(32),
  depositRoot: strToField('depositRoot').toHex(32),
  migrationRoot: strToField('migrationRoot').toHex(32),
}

export async function getDummyBody(): Promise<Body> {
  return {
    txs: await loadZkTxs(),
    massDeposits: [
      {
        merged: strToField('md1/merged').toHex(32),
        fee: strToField('md1/fee').toHex(32),
      },
      {
        merged: strToField('md2/merged').toHex(32),
        fee: strToField('md2/fee').toHex(32),
      },
    ],
    massMigrations: [
      {
        destination: strToField('mm1/dest').toHex(32),
        totalETH: strToField('mm1/totalETH').toHex(32),
        migratingLeaves: {
          merged: strToField('mm1/md').toHex(32),
          fee: strToField('mm1/fee').toHex(32),
        },
        erc20: [
          {
            addr: strToField('mm1/erc20').toHex(32),
            amount: strToField('mm1/amount').toHex(32),
          },
        ],
        erc721: [
          {
            addr: strToField('mm1/erc721').toHex(32),
            nfts: [
              strToField('mm1/erc721/nft1').toHex(32),
              strToField('mm1/erc721/nft2').toHex(32),
              strToField('mm1/erc721/nft3').toHex(32),
            ],
          },
        ],
      },
    ],
  }
}
