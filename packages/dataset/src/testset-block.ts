import {
  Header,
  Body,
  Block,
  serializeHeader,
  serializeBody,
  massDepositHash,
  massMigrationHash,
} from '@zkopru/core'
import { Fp } from '@zkopru/babyjubjub'
import { Address } from 'soltypes'
import { root } from '@zkopru/utils'
import { Transaction } from 'web3-core'
import AbiCoder from 'web3-eth-abi'
import { loadZkTxs } from './testset-zktxs'

function strToFp(val: string): Fp {
  return Fp.fromBuffer(Buffer.from(val))
}

export const dummyHeader: Header = {
  proposer: Address.from(strToFp('proposer').toHex(20)),
  parentBlock: strToFp('parentBlock').toBytes32(),
  fee: strToFp('totalFee').toUint256(),
  utxoRoot: strToFp('utxoRoot').toUint256(),
  utxoIndex: strToFp('utxoIndex').toUint256(),
  withdrawalRoot: strToFp('withdrawalRoot').toUint256(),
  withdrawalIndex: strToFp('withdrawalIndex').toUint256(),
  nullifierRoot: strToFp('nullifierRoot').toBytes32(),
  txRoot: strToFp('txRoot').toBytes32(),
  depositRoot: strToFp('depositRoot').toBytes32(),
  migrationRoot: strToFp('migrationRoot').toBytes32(),
}

export async function getDummyBody(): Promise<Body> {
  return {
    txs: await loadZkTxs(),
    massDeposits: [
      {
        merged: strToFp('md1/merged').toBytes32(),
        fee: strToFp('md1/fee').toUint256(),
      },
      {
        merged: strToFp('md2/merged').toBytes32(),
        fee: strToFp('md2/fee').toUint256(),
      },
    ],
    massMigrations: [
      {
        destination: Address.from(strToFp('mm1/dest').toHex(20)),
        asset: {
          eth: strToFp('mm1/totalETH').toUint256(),
          token: strToFp('mm1/totalETH').toAddress(),
          amount: strToFp('mm1/totalETH').toUint256(),
        },
        depositForDest: {
          merged: strToFp('mm1/md').toBytes32(),
          fee: strToFp('mm1/fee').toUint256(),
        },
      },
    ],
  }
}

export async function getDummyBlock(): Promise<Block> {
  const header = dummyHeader
  const body = await getDummyBody()
  header.txRoot = root(body.txs.map(tx => tx.hash()))
  header.depositRoot = root(body.massDeposits.map(massDepositHash))
  header.migrationRoot = root(body.massMigrations.map(massMigrationHash))
  const serializedBlock = Buffer.concat([
    serializeHeader(header),
    serializeBody(body),
  ])
  // Need a real selector or the abi decoder will fail
  const encodeFunctionSignature = (AbiCoder as any).encodeFunctionSignature.bind(
    AbiCoder,
  )
  const encodeParameters = (AbiCoder as any).encodeParameters.bind(AbiCoder)
  const dummySelector = encodeFunctionSignature('propose(bytes)')
  const inputData = encodeParameters(['bytes'], [serializedBlock])
  const dummyTx: Transaction = {
    hash: 'dummyhash',
    nonce: 1,
    blockHash: 'dummyblockhash',
    blockNumber: 10000,
    transactionIndex: 3,
    from: 'dummyfrom',
    to: 'dummyto',
    value: 'dummyvalue',
    gasPrice: 'dummygas',
    gas: 11,
    input: `0x${dummySelector.replace('0x', '')}${inputData.replace('0x', '')}`,
  }
  return Block.fromTx(dummyTx)
}
