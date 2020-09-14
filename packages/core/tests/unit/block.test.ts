/**
 * @jest-environment node
 */
import { Transaction } from 'web3-core'
import { hexify } from '@zkopru/utils'
import { getDummyBody, dummyHeader } from '~dataset/testset-block'
import { serializeHeader, serializeBody, Block, headerHash } from '~core'

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
    const dummySelector = 'aaaaaaaa'
    const lengthToHex = hexify(serializedBlock.length, 32).slice(2)
    const paramPosition = hexify(32, 32).slice(2)
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
      input: `0x${dummySelector}${paramPosition}${lengthToHex}${serializedBlock.toString(
        'hex',
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
      expect(mm.totalETH).toStrictEqual(body.massMigrations[i].totalETH)
      expect(mm.migratingLeaves.merged).toStrictEqual(
        body.massMigrations[i].migratingLeaves.merged,
      )
      expect(mm.migratingLeaves.fee).toStrictEqual(
        body.massMigrations[i].migratingLeaves.fee,
      )
      expect(mm.erc20).toHaveLength(body.massMigrations[i].erc20.length)
      expect(mm.erc721).toHaveLength(body.massMigrations[i].erc721.length)
      mm.erc20.forEach((token, j) => {
        expect(token.addr).toStrictEqual(body.massMigrations[i].erc20[j].addr)
        expect(token.amount).toStrictEqual(
          body.massMigrations[i].erc20[j].amount,
        )
      })
      mm.erc721.forEach((token, j) => {
        expect(token.addr).toStrictEqual(body.massMigrations[i].erc721[j].addr)
        token.nfts.forEach((nft, k) => {
          expect(nft).toStrictEqual(body.massMigrations[i].erc721[j].nfts[k])
        })
      })
    })
  }, 600000)
})
