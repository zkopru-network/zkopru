import { Field } from '@zkopru/babyjubjub'
import {
  Block,
  Header,
  Body,
  massDepositHash,
  MassMigration,
  massMigrationHash,
  headerHash,
  getMassMigrations,
} from '@zkopru/core'
import { OutflowType, Withdrawal } from '@zkopru/transaction'
import { Leaf } from '@zkopru/tree'
import { logger, root, bnToBytes32, bnToUint256 } from '@zkopru/utils'
import { Address } from 'soltypes'
import BN from 'bn.js'
import { GeneratorBase } from '../interfaces/generator-base'

export class BlockGenerator extends GeneratorBase {
  async genBlock(): Promise<Block> {
    if (!this.context.gasPrice) {
      throw Error('coordinator.js: Gas price is not synced')
    }

    // Calculate consumed bytes and aggregated fee
    let consumedBytes = 32 // bytes length
    let aggregatedFee: Field = Field.zero

    const { layer2 } = this.context.node
    // 1. pick mass deposits
    const pendingMassDeposits = await layer2.getPendingMassDeposits()
    consumedBytes += pendingMassDeposits.calldataSize
    aggregatedFee = aggregatedFee.add(pendingMassDeposits.totalFee)

    // 2. pick transactions
    const pendingTxs = await this.context.txPool.pickTxs(
      this.context.config.maxBytes - consumedBytes,
      this.context.gasPrice.muln(this.context.config.priceMultiplier),
    )
    const txs = pendingTxs || []
    aggregatedFee = aggregatedFee.add(
      txs.map(tx => tx.fee).reduce((prev, fee) => prev.add(fee), Field.zero),
    )
    // TODO 3 make sure every nullifier is unique and not used before
    // * if there exists invalid transactions, remove them from the tx pool and try genBlock recursively
    const utxos = txs
      .reduce((arr, tx) => {
        return [
          ...arr,
          ...tx.outflow
            .filter(outflow => outflow.outflowType.isZero())
            .map(outflow => outflow.note),
        ]
      }, pendingMassDeposits.leaves)
      .map(hash => ({ hash })) as Leaf<Field>[]

    const withdrawals: Leaf<BN>[] = txs.reduce((arr, tx) => {
      return [
        ...arr,
        ...tx.outflow
          .filter(outflow => outflow.outflowType.eqn(OutflowType.WITHDRAWAL))
          .map(outflow => {
            if (!outflow.data) throw Error('No withdrawal public data')
            return {
              hash: Withdrawal.withdrawalHash(
                outflow.note,
                outflow.data,
              ).toBN(),
              noteHash: outflow.note,
            }
          }),
      ]
    }, [] as Leaf<BN>[])

    if (
      pendingMassDeposits.leaves.length ||
      txs.length ||
      this.context.txPool.pendingNum() ||
      withdrawals.length
    ) {
      logger.info(`Pending deposits: ${pendingMassDeposits.leaves.length}`)
      logger.info(`Picked txs: ${txs.length}`)
      logger.info(`Pending txs: ${this.context.txPool.pendingNum()}`)
      logger.info(`Withdrawals: ${withdrawals.length}`)
    }
    const nullifiers = txs.reduce((arr, tx) => {
      return [...arr, ...tx.inflow.map(inflow => inflow.nullifier)]
    }, [] as Field[])

    if (!this.context.node.synchronizer.isSynced()) {
      throw Error('Layer 2 chain is not synced yet.')
    }
    const latest = await this.context.node.latestBlock()
    logger.info(`Trying to create a child block of ${latest}`)
    // TODO acquire lock during gen block
    const massMigrations: MassMigration[] = getMassMigrations(txs)
    const expectedGrove = await layer2.grove.dryPatch({
      utxos,
      withdrawals,
      nullifiers,
    })
    logger.info(
      `nullifiers: ${JSON.stringify(nullifiers.map(f => f.toString()))}`,
    )
    if (!expectedGrove.nullifierTreeRoot) {
      throw Error(
        'Grove does not have the nullifier tree. Use full node option',
      )
    }
    const { massDeposits } = pendingMassDeposits
    const header: Header = {
      proposer: Address.from(this.context.account.address),
      parentBlock: latest,
      fee: aggregatedFee.toUint256(),
      utxoRoot: expectedGrove.utxoTreeRoot.toUint256(),
      utxoIndex: expectedGrove.utxoTreeIndex.toUint256(),
      nullifierRoot: bnToBytes32(expectedGrove.nullifierTreeRoot),
      withdrawalRoot: bnToUint256(expectedGrove.withdrawalTreeRoot),
      withdrawalIndex: bnToUint256(expectedGrove.withdrawalTreeIndex),
      txRoot: root(txs.map(tx => tx.hash())),
      depositRoot: root(massDeposits.map(massDepositHash)),
      migrationRoot: root(massMigrations.map(massMigrationHash)),
    }
    const body: Body = {
      txs,
      massDeposits,
      massMigrations,
    }
    return new Block({
      hash: headerHash(header),
      header,
      body,
    })
  }
}
