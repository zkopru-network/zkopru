/**
 * @jest-environment node
 */
import { Transaction } from 'web3-core'
import AbiCoder from 'web3-eth-abi'
import { getDummyBody, dummyHeader } from '~dataset/testset-block'
import { serializeHeader, serializeBody, Block, headerHash } from '~core'

const encodeFunctionSignature = (AbiCoder as any).encodeFunctionSignature.bind(
  AbiCoder,
)

describe('block.ts', () => {
  it('should be serialized and deserialized', async () => {
    const header = dummyHeader
    const body = await getDummyBody()
    expect(header).toBeDefined()
    expect(body).toBeDefined()
    const serializedBlock = Buffer.concat([
      serializeHeader(header),
      serializeBody(body),
    ])
    const dummySelector = encodeFunctionSignature('propose(bytes)')
    const encodeParameters = (AbiCoder as any).encodeParameters.bind(AbiCoder)
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
      input: `0x${dummySelector.replace('0x', '')}${inputData.replace(
        '0x',
        '',
      )}`,
    }
    const deserializedBlock = Block.fromTx(dummyTx)
    expect(deserializedBlock).toBeDefined()
    const dHeader = deserializedBlock.header
    expect(dHeader.proposer).toStrictEqual(header.proposer)
    expect(dHeader.parentBlock).toStrictEqual(header.parentBlock)
    expect(dHeader.fee).toStrictEqual(header.fee)
    expect(dHeader.utxoRoot).toStrictEqual(header.utxoRoot)
    expect(dHeader.utxoIndex).toStrictEqual(header.utxoIndex)
    expect(dHeader.nullifierRoot).toStrictEqual(header.nullifierRoot)
    expect(dHeader.withdrawalRoot).toStrictEqual(header.withdrawalRoot)
    expect(dHeader.withdrawalIndex).toStrictEqual(header.withdrawalIndex)
    expect(dHeader.txRoot).toStrictEqual(header.txRoot)
    expect(dHeader.depositRoot).toStrictEqual(header.depositRoot)
    expect(dHeader.migrationRoot).toStrictEqual(header.migrationRoot)
    expect(headerHash(dHeader)).toStrictEqual(headerHash(header))
    const dBody = deserializedBlock.body
    expect(dBody.txs).toHaveLength(body.txs.length)
    expect(dBody.massDeposits).toHaveLength(body.massDeposits.length)
    expect(dBody.massMigrations).toHaveLength(body.massMigrations.length)
    dBody.txs.forEach((tx, i) => {
      expect(tx.hash()).toStrictEqual(body.txs[i].hash())
    })
    dBody.massDeposits.forEach((md, i) => {
      expect(md.merged).toStrictEqual(body.massDeposits[i].merged)
      expect(md.fee).toStrictEqual(body.massDeposits[i].fee)
    })
    dBody.massMigrations.forEach((mm, i) => {
      expect(mm.destination).toStrictEqual(body.massMigrations[i].destination)
      expect(mm.asset.eth).toStrictEqual(body.massMigrations[i].asset.eth)
      expect(mm.asset.token).toStrictEqual(body.massMigrations[i].asset.token)
      expect(mm.asset.amount).toStrictEqual(body.massMigrations[i].asset.amount)
      expect(mm.depositForDest.merged).toStrictEqual(
        body.massMigrations[i].depositForDest.merged,
      )
      expect(mm.depositForDest.fee).toStrictEqual(
        body.massMigrations[i].depositForDest.fee,
      )
    })
  }, 600000)
})
