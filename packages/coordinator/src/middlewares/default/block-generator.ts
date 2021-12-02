import { Fp } from '@zkopru/babyjubjub'
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
import { OutflowType, Withdrawal, ZkTx } from '@zkopru/transaction'
import { Leaf, DryPatchResult } from '@zkopru/tree'
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
    let aggregatedFee: Fp = Fp.zero

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
    const usedNullifiers = {}
    const validPendingsTxs = (
      await Promise.all(
        pendingTxs.map(async tx => {
          const valid = await this.context.node.layer2.isValidTx(tx)
          return valid ? tx : undefined
        }),
      )
    ).filter(tx => {
      if (!tx) return false
      const nullifiers = tx.inflow.map(({ nullifier }) => nullifier.toString())
      for (const nullifier of nullifiers) {
        if (usedNullifiers[nullifier]) {
          return false
        }
        usedNullifiers[nullifier] = true
      }
      return true
    }) as ZkTx[]
    const txs = [] as ZkTx[]
    // check each pending tx to make sure it doesn't break the dry patch
    for (const tx of validPendingsTxs) {
      const { ok } = await this.dryRun([...txs, tx], pendingMassDeposits)
      if (!ok) {
        logger.info('Warning, transaction dry run not ok, skipping')
      } else {
        txs.push(tx)
      }
    }
    const { expectedGrove, ok } = await this.dryRun(txs, pendingMassDeposits)
    if (!ok || !expectedGrove) {
      throw new Error('Unexpected grove patch failure in block proposal')
    }
    aggregatedFee = aggregatedFee.add(
      txs.map(tx => tx.fee).reduce((prev, fee) => prev.add(fee), Fp.zero),
    )
    // TODO 3 make sure every nullifier is unique and not used before
    // * if there exists invalid transactions, remove them from the tx pool and try genBlock recursively

    if (
      pendingMassDeposits.leaves.length ||
      txs.length ||
      this.context.txPool.pendingNum()
      // withdrawals.length
    ) {
      logger.info(`Pending deposits: ${pendingMassDeposits.leaves.length}`)
      logger.info(`Picked txs: ${txs.length}`)
      logger.info(`Pending txs: ${this.context.txPool.pendingNum()}`)
      // logger.info(`Withdrawals: ${withdrawals.length}`)
    }
    if (!this.context.node.synchronizer.isSynced()) {
      throw Error('Layer 2 chain is not synced yet.')
    }
    const latest = await this.context.node.layer2.latestBlock()
    logger.info(`Trying to create a child block of ${latest}`)
    // TODO acquire lock during gen block
    const massMigrations: MassMigration[] = getMassMigrations(txs)
    // logger.info(
    //   `nullifiers: ${JSON.stringify(nullifiers.map(f => f.toString()))}`,
    // )
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

  async dryRun(
    txs: ZkTx[],
    pendingMassDeposits: any,
  ): Promise<{
    expectedGrove?: DryPatchResult
    ok: boolean
  }> {
    try {
      const utxos = txs
        .reduce((arr, tx) => {
          return [
            ...arr,
            ...tx.outflow
              .filter(outflow => outflow.outflowType.eqn(OutflowType.UTXO))
              .map(outflow => outflow.note),
          ]
        }, pendingMassDeposits.leaves)
        .map(hash => ({ hash })) as Leaf<Fp>[]

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
      const nullifiers = txs.reduce((arr, tx) => {
        return [...arr, ...tx.inflow.map(inflow => inflow.nullifier)]
      }, [] as Fp[])
      const { layer2 } = this.context.node
      const expectedGrove = await layer2.grove.dryPatch({
        utxos,
        withdrawals,
        nullifiers,
      })
      return {
        expectedGrove,
        ok: true,
      }
    } catch (e) {
      return {
        ok: false,
      }
    }
  }
}
