/* eslint-disable class-methods-use-this */
import { Fp } from '@zkopru/babyjubjub'
import { ZkTx } from '@zkopru/transaction'
import { Header as HeaderSql } from '@zkopru/database'
import { Hasher, keccakHasher, SMT } from '@zkopru/tree'
import assert from 'assert'
import { Address, Bytes32, Uint256 } from 'soltypes'
import { BigNumber } from 'ethers'
import { headerHash } from '../../block'
import { CODE } from '../code'
import { BlockData, HeaderData, Validation, TxValidator } from '../types'
import { blockDataToBlock, headerDataToHeader } from '../utils'
import { L2Chain } from '../../context/layer2'
import { OffchainValidatorContext } from './offchain-context'

export class OffchainTxValidator extends OffchainValidatorContext
  implements TxValidator {
  nullifierTreeHasher: Hasher<BigNumber>

  constructor(layer2: L2Chain) {
    super(layer2)
    this.nullifierTreeHasher = keccakHasher(layer2.config.nullifierTreeDepth)
  }

  async validateInclusion(
    data: BlockData,
    txIndex: Uint256,
    inflowIndex: Uint256,
  ): Promise<Validation> {
    const block = blockDataToBlock(data)
    const tx = block.body.txs[txIndex.toBigNumber().toNumber()]
    const ref = tx.inflow[inflowIndex.toBigNumber().toNumber()].root

    return {
      slashable: !(await this.isValidRef(
        headerHash(block.header),
        ref.toUint256(),
      )),
      reason: CODE.T1,
    }
  }

  async validateOutflow(
    data: BlockData,
    txIndex: Uint256,
  ): Promise<Validation> {
    const block = blockDataToBlock(data)
    const tx = block.body.txs[txIndex.toBigNumber().toNumber()]
    for (let i = 0; i < tx.outflow.length; i += 1) {
      const outflow = tx.outflow[i]
      // Outflow type should be 0, 1, or 2.
      if (outflow.outflowType.gt(2)) {
        return { slashable: true, reason: CODE.T2 }
      }
      if (outflow.outflowType.eq(0)) {
        // UTXO type
        const isEmpty =
          !outflow.data ||
          (outflow.data.to.eq(0) &&
            outflow.data.eth.eq(0) &&
            outflow.data.tokenAddr.eq(0) &&
            outflow.data.erc20Amount.eq(0) &&
            outflow.data.nft.eq(0) &&
            outflow.data.fee.eq(0))
        if (!isEmpty) {
          return { slashable: true, reason: CODE.T3 }
        }
      } else if (outflow.data?.tokenAddr && !outflow.data?.tokenAddr.eq(0)) {
        // (ETH + token) withdrawal or migration
        const tokenAddr = outflow.data?.tokenAddr
        const registeredInfo = await this.layer2.db.findOne('TokenRegistry', {
          where: { address: Address.from(tokenAddr.toHexString()).toString() },
        })
        if (!registeredInfo) {
          return { slashable: true, reason: CODE.T4 }
        }
        if (registeredInfo.isERC20) {
          if (!outflow.data?.nft.eq(0)) {
            return { slashable: true, reason: CODE.T5 }
          }
        } else if (registeredInfo.isERC721) {
          if (!outflow.data?.erc20Amount.eq(0)) {
            return { slashable: true, reason: CODE.T6 }
          }
          if (outflow.data?.nft.eq(0)) {
            return { slashable: true, reason: CODE.T7 }
          }
        }
      } else {
        // ETH withdrawal or migration
        if (!outflow.data?.nft.eq(0)) {
          return { slashable: true, reason: CODE.T5 }
        }
        if (!outflow.data?.erc20Amount.eq(0)) {
          return { slashable: true, reason: CODE.T6 }
        }
      }
    }
    return { slashable: false }
  }

  async validateAtomicSwap(
    data: BlockData,
    txIndex: Uint256,
  ): Promise<Validation> {
    const block = blockDataToBlock(data)
    const txA = block.body.txs[txIndex.toBigNumber().toNumber()]
    assert(txA.swap, 'This tx does not have atomic swap')
    for (const txB of block.body.txs.filter(tx => !!tx.swap)) {
      assert(txB.swap, 'Already filtered txs with atomic swap field')
      if (
        this.includeSwapNote(txA, txB.swap) &&
        this.includeSwapNote(txB, txA.swap)
      ) {
        return { slashable: false }
      }
    }
    return { slashable: true, reason: CODE.T8 }
  }

  async validateUsedNullifier(
    blockData: BlockData,
    parentHeaderData: HeaderData,
    txIndex: Uint256,
    inflowIndex: Uint256,
    siblings: Bytes32[],
  ): Promise<Validation> {
    const block = blockDataToBlock(blockData)
    const parentHeader = headerDataToHeader(parentHeaderData)
    const usedNullifier =
      block.body.txs[txIndex.toBigNumber().toNumber()].inflow[
        inflowIndex.toBigNumber().toNumber()
      ].nullifier
    try {
      SMT.fill(
        this.nullifierTreeHasher,
        parentHeader.nullifierRoot.toBigNumber(),
        usedNullifier.toUint256().toBigNumber(),
        siblings.map(s => s.toBigNumber()),
      )
    } catch (err) {
      return { slashable: true, reason: CODE.T9 }
    }
    return { slashable: false }
  }

  async validateDuplicatedNullifier(
    data: BlockData,
    nullifier: Bytes32,
  ): Promise<Validation> {
    const block = blockDataToBlock(data)
    let count = 0
    for (const tx of block.body.txs) {
      for (const inflow of tx.inflow) {
        if (inflow.nullifier.eq(nullifier.toBigNumber())) {
          count += 1
        }
        if (count >= 2) {
          return { slashable: true, reason: CODE.T10 }
        }
      }
    }
    return { slashable: false }
  }

  async isValidRef(
    blockHash: Bytes32,
    inclusionRef: Uint256,
  ): Promise<boolean> {
    // Find the header of the referenced utxo root
    const headers = await this.layer2.db.findMany('Header', {
      where: {
        utxoRoot: inclusionRef.toString(),
      },
    })
    // If any of the found header is finalized, it returns true
    const finalized = await this.layer2.db.findMany('Proposal', {
      where: {
        hash: headers.map(h => h.hash),
      },
    })
    // TODO: use index when booleans are supported
    if (finalized.find(p => !!p.finalized)) return true
    // Or check the recent precedent blocks has that utxo tree root
    let childBlockHeader: HeaderSql | undefined
    for (let i = 0; i < this.layer2.config.referenceDepth; i += 1) {
      if (!childBlockHeader) {
        const childBlock = await this.layer2.db.findOne('Block', {
          where: { hash: blockHash.toString() },
          include: { header: true, slash: true },
        })
        childBlockHeader = childBlock.header
      }
      assert(childBlockHeader)
      const parentBlock = await this.layer2.db.findOne('Block', {
        where: { hash: childBlockHeader.parentBlock },
        include: { header: true, slash: true },
      })
      childBlockHeader = parentBlock.header
      if (parentBlock === null || parentBlock.slash !== null) {
        return false
      }
      if (inclusionRef.eq(Uint256.from(parentBlock.header.utxoRoot))) {
        return true
      }
    }
    return false
  }

  async validateSNARK(data: BlockData, txIndex: Uint256): Promise<Validation> {
    const block = blockDataToBlock(data)
    const tx = block.body.txs[txIndex.toBigNumber().toNumber()]
    let slash: Validation
    if (!this.layer2.snarkVerifier.hasVK(tx.inflow.length, tx.outflow.length)) {
      slash = {
        slashable: true,
        reason: CODE.S1,
      }
    } else {
      const verified = await this.layer2.snarkVerifier.verifyTx(tx)
      slash = {
        slashable: !verified,
        reason: CODE.S2,
      }
    }
    return slash
  }

  private includeSwapNote(tx: ZkTx, expected: Fp) {
    if (!tx.swap || tx.swap.eq(0)) return false
    for (let i = 0; i < tx.outflow.length; i += 1) {
      if (tx.outflow[i].note.eq(expected)) return true
    }
    return false
  }
}
