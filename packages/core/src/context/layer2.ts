import {
  DB,
  Deposit as DepositSql,
  Config,
  Proposal,
  MassDeposit as MassDepositSql,
} from '@zkopru/prisma'
import { Grove, GrovePatch, Leaf } from '@zkopru/tree'
import BN from 'bn.js'
import AsyncLock from 'async-lock'
import { Bytes32, Address, Uint256 } from 'soltypes'
import { logger, VerifyingKey } from '@zkopru/utils'
import { Field } from '@zkopru/babyjubjub'
import {
  OutflowType,
  UtxoStatus,
  WithdrawalStatus,
  Withdrawal,
  TokenRegistry,
} from '@zkopru/transaction'
import { Block, Header, MassDeposit, massDepositHash } from '../block'
import { BootstrapData } from '../node/bootstrap'
import { SNARKVerifier } from '../snark/snark-verifier'

export interface Patch {
  block: Bytes32
  header: Header
  prevHeader: Header
  massDeposits?: Bytes32[]
  treePatch: GrovePatch
  nullifiers?: Uint256[]
}

export class L2Chain {
  config: Config

  snarkVerifier: SNARKVerifier

  lock: AsyncLock

  grove: Grove

  tokenRegistry: TokenRegistry

  db: DB

  constructor(
    db: DB,
    grove: Grove,
    config: Config,
    vks: { [txType: string]: VerifyingKey },
  ) {
    this.db = db
    this.grove = grove
    this.config = config
    this.snarkVerifier = new SNARKVerifier(vks)
    this.tokenRegistry = new TokenRegistry()
    this.lock = new AsyncLock()
  }

  async getBlock(hash: Bytes32): Promise<Block | null> {
    const proposal = await this.db.read(prisma =>
      prisma.proposal.findOne({
        where: { hash: hash.toString() },
        include: { block: true },
      }),
    )
    if (!proposal || !proposal.proposalData) return null
    const tx = JSON.parse(proposal.proposalData)
    return Block.fromTx(tx, proposal.verified || false)
  }

  async getProposal(hash: Bytes32) {
    const proposal = await this.db.read(prisma =>
      prisma.proposal.findOne({
        where: { hash: hash.toString() },
        include: { block: true },
      }),
    )
    return proposal
  }

  async getLatestVerified(): Promise<string | null> {
    const lastVerifiedProposal: Proposal | undefined = (
      await this.db.read(prisma =>
        prisma.proposal.findMany({
          where: {
            AND: [{ verified: true }, { isUncle: null }],
          },
          orderBy: { proposalNum: 'desc' },
          include: { block: { include: { header: true } } },
          take: 1,
        }),
      )
    ).pop()
    if (lastVerifiedProposal) return lastVerifiedProposal.hash
    return null
  }

  async getDeposits(...massDeposits: MassDeposit[]): Promise<DepositSql[]> {
    const totalDeposits: DepositSql[] = []
    for (const massDeposit of massDeposits) {
      const commits = await this.db.read(prisma =>
        prisma.massDeposit.findMany({
          where: {
            AND: [
              { merged: massDeposit.merged.toString() },
              { fee: massDeposit.fee.toString() },
            ],
          },
          orderBy: {
            blockNumber: 'asc',
          },
          take: 1,
        }),
      )
      // logger.info()
      const nonIncludedMassDepositCommit = commits.pop()
      if (!nonIncludedMassDepositCommit) {
        logger.info(massDeposit.merged.toString())
        logger.info(`fee ${massDeposit.fee.toString()}`)
        throw Error('Failed to find the mass deposit')
      }

      const deposits = await this.db.read(prisma =>
        prisma.deposit.findMany({
          where: { queuedAt: nonIncludedMassDepositCommit.index },
        }),
      )
      deposits.sort((a, b) => {
        if (a.blockNumber !== b.blockNumber) {
          return a.blockNumber - b.blockNumber
        }
        if (a.transactionIndex !== b.transactionIndex) {
          return a.transactionIndex - b.transactionIndex
        }
        return a.logIndex - b.logIndex
      })
      totalDeposits.push(...deposits)
    }
    return totalDeposits
  }

  async getOldestUnprocessedBlock(): Promise<
    | undefined
    | {
        parent: Header
        block: Block
        proposal: Proposal
      }
  > {
    const unprocessedProposals = await this.db.read(prisma =>
      prisma.proposal.findMany({
        where: {
          AND: [{ verified: null }, { isUncle: null }],
        },
        orderBy: { proposalNum: 'asc' },
        take: 1,
        include: { block: { include: { header: true } } },
      }),
    )
    const unprocessedProposal = unprocessedProposals.pop()
    if (
      !unprocessedProposal ||
      !unprocessedProposal.proposalData ||
      !unprocessedProposal.proposalNum
    )
      return

    logger.trace(`unprocessed proposal: ${unprocessedProposal?.hash}`)
    const parentHash = unprocessedProposal.block?.header.parentBlock
    if (!parentHash) throw Error('Its parent block is not processed yet')

    const parentHeader = await this.db.read(prisma =>
      prisma.header.findOne({
        where: { hash: parentHash },
      }),
    )
    logger.trace(`last verified header: ${parentHeader?.hash}`)
    if (!parentHeader) throw Error('Parent header does not exist.')

    const tx = JSON.parse(unprocessedProposal.proposalData)
    const block = Block.fromTx(tx)
    return {
      parent: {
        proposer: Address.from(parentHeader.proposer),
        parentBlock: Bytes32.from(parentHeader.parentBlock),
        fee: Uint256.from(parentHeader.fee),
        utxoRoot: Uint256.from(parentHeader.utxoRoot),
        utxoIndex: Uint256.from(parentHeader.utxoIndex),
        nullifierRoot: Bytes32.from(parentHeader.nullifierRoot),
        withdrawalRoot: Uint256.from(parentHeader.withdrawalRoot),
        withdrawalIndex: Uint256.from(parentHeader.withdrawalIndex),
        txRoot: Bytes32.from(parentHeader.txRoot),
        depositRoot: Bytes32.from(parentHeader.depositRoot),
        migrationRoot: Bytes32.from(parentHeader.migrationRoot),
      },
      block,
      proposal: unprocessedProposal,
    }
  }

  async isUncleBlock(
    parentBlock: Bytes32,
    proposalNum: number,
  ): Promise<boolean> {
    const canonical = await this.db.read(prisma =>
      prisma.proposal.findMany({
        where: {
          AND: [
            { proposalNum: { lt: proposalNum } },
            {
              block: {
                header: { parentBlock: { equals: parentBlock.toString() } },
              },
            },
            { verified: true },
          ],
        },
        orderBy: { proposalNum: 'asc' },
        take: 1,
      }),
    )
    return canonical.length === 1
  }

  async applyPatch(patch: Patch) {
    logger.info('layer2.ts: applyPatch()')
    const { block, header, prevHeader, treePatch, massDeposits } = patch
    // Apply tree patch
    const { utxoTreeId, withdrawalTreeId } = await this.grove.applyGrovePatch(
      treePatch,
    )
    await this.nullifyUtxos(block, treePatch.nullifiers)
    // Update mass deposits inclusion status
    if (massDeposits) {
      await this.markMassDepositsAsIncludedIn(massDeposits, block)
    }
    await this.markUtxosAsUnspent(patch.treePatch?.utxos || [])
    await this.markWithdrawalsAsUnfinalized(patch.treePatch?.withdrawals || [])
    const utxoLeafStartIndex = header.utxoIndex
      .toBN()
      .gt(prevHeader.utxoIndex.toBN())
      ? prevHeader.utxoIndex.toBN() // appending to an exising utxo tree
      : new BN(0) // started new utxo tree
    await this.updateUtxoLeafIndexes(
      utxoTreeId,
      utxoLeafStartIndex,
      patch.treePatch?.utxos || [],
    )
    const withdrawalLeafStartIndex = header.withdrawalIndex
      .toBN()
      .gt(prevHeader.withdrawalIndex.toBN())
      ? prevHeader.withdrawalIndex.toBN() // appending to an exising utxo tree
      : new BN(0) // started new utxo tree
    await this.updateWithdrawalLeafIndexes(
      withdrawalTreeId,
      withdrawalLeafStartIndex,
      patch.treePatch?.withdrawals || [],
    )
    await this.updateWithdrawalProof(block, patch.treePatch?.withdrawals || [])
  }

  private async markUtxosAsUnspent(utxos: Leaf<Field>[]) {
    await this.db.write(prisma =>
      prisma.utxo.updateMany({
        where: {
          hash: { in: utxos.map(utxo => utxo.hash.toUint256().toString()) },
        },
        data: { status: UtxoStatus.UNSPENT },
      }),
    )
  }

  private async markWithdrawalsAsUnfinalized(withdrawals: Leaf<BN>[]) {
    await this.db.write(prisma =>
      prisma.withdrawal.updateMany({
        where: {
          hash: {
            in: withdrawals.map(Withdrawal => Withdrawal.hash.toString()),
          },
        },
        data: { status: WithdrawalStatus.UNFINALIZED },
      }),
    )
  }

  async applyBootstrap(block: Block, bootstrapData: BootstrapData) {
    this.grove.applyBootstrap(bootstrapData)
    const blockSql = { ...block.toSqlObj() }
    const headerSql = block.getHeaderSql()
    this.db.write(prisma =>
      prisma.block.upsert({
        where: {
          hash: block.hash.toString(),
        },
        update: {},
        create: {
          ...blockSql,
          proposal: {
            create: bootstrapData.proposal,
          },
          header: {
            create: headerSql,
          },
        },
      }),
    )
  }

  private async markMassDepositsAsIncludedIn(
    massDepositHashes: Bytes32[],
    block: Bytes32,
  ) {
    const nonIncluded = await this.db.read(prisma =>
      prisma.massDeposit.findMany({
        where: {
          includedIn: null,
        },
      }),
    )
    const candidates: { [index: string]: MassDepositSql } = {}
    nonIncluded.forEach(md => {
      candidates[md.index] = md
    })

    // TODO need batch query
    const indexes: string[] = []
    for (const hash of massDepositHashes) {
      for (const index of Object.keys(candidates).sort()) {
        const md = candidates[index]
        if (
          hash.eq(
            massDepositHash({
              merged: Bytes32.from(md.merged),
              fee: Uint256.from(md.fee),
            }),
          )
        ) {
          indexes.push(index)
          delete candidates[index]
          break
        }
      }
    }
    await this.db.write(prisma =>
      prisma.massDeposit.updateMany({
        where: { index: { in: indexes } },
        data: { includedIn: block.toString() },
      }),
    )
  }

  private async nullifyUtxos(blockHash: Bytes32, nullifiers: BN[]) {
    await this.db.write(prisma =>
      prisma.utxo.updateMany({
        where: { nullifier: { in: nullifiers.map(v => v.toString()) } },
        data: {
          status: UtxoStatus.SPENT,
          usedAt: blockHash.toString(),
        },
      }),
    )
  }

  private async updateUtxoLeafIndexes(
    utxoTreeId: string,
    startIndex: BN,
    utxos: Leaf<Field>[],
  ) {
    for (let i = 0; i < utxos.length; i += 1) {
      const index = startIndex.addn(i)
      const leaf = utxos[i]
      const { hash, shouldTrack } = leaf
      logger.debug(leaf)
      logger.debug(`hash: ${hash}, shouldTrack: ${shouldTrack}`)
      if (shouldTrack) {
        await this.db.write(prisma =>
          prisma.utxo.update({
            where: { hash: hash.toString() },
            data: {
              index: index.toString(),
              tree: { connect: { id: utxoTreeId } },
            },
          }),
        )
      }
    }
  }

  private async updateWithdrawalLeafIndexes(
    withdrawalTreeId: string,
    startIndex: BN,
    withdrawals: Leaf<BN>[],
  ) {
    for (let i = 0; i < withdrawals.length; i += 1) {
      const index = startIndex.addn(i)
      const leaf = withdrawals[i]
      const { noteHash, shouldTrack } = leaf
      if (!noteHash) throw Error('Withdrawal leaf should contain note hash')
      if (shouldTrack) {
        await this.db.write(prisma =>
          prisma.withdrawal.update({
            where: { hash: noteHash.toString() },
            data: {
              index: index.toString(),
              tree: { connect: { id: withdrawalTreeId } },
            },
          }),
        )
      }
    }
  }

  private async updateWithdrawalProof(
    blockHash: Bytes32,
    withdrawals: Leaf<BN>[],
  ) {
    const myWithdrawals = withdrawals.filter(w => w.shouldTrack)
    for (const withdrawal of myWithdrawals) {
      const { noteHash } = withdrawal
      if (!noteHash) throw Error('Withdrawal does not have note hash')
      const merkleProof = await this.grove.withdrawalMerkleProof(noteHash)
      await this.db.write(prisma =>
        prisma.withdrawal.update({
          where: { hash: noteHash.toString() },
          data: {
            includedIn: blockHash.toString(),
            siblings: JSON.stringify(
              merkleProof.siblings.map(sib => sib.toString(10)),
            ),
          },
        }),
      )
    }
  }

  async getGrovePatch(block: Block): Promise<GrovePatch> {
    logger.info(`get grove patch for block ${block.hash.toString()}`)
    const header = block.hash.toString()
    const utxos: Leaf<Field>[] = []
    const withdrawals: Leaf<BN>[] = []
    const nullifiers: Field[] = []

    const deposits = await this.getDeposits(...block.body.massDeposits)
    const utxoHashes: Field[] = []
    utxoHashes.push(...deposits.map(deposit => Field.from(deposit.note)))

    const withdrawalHashes: { noteHash: Field; withdrawalHash: Uint256 }[] = []
    for (const tx of block.body.txs) {
      for (const outflow of tx.outflow) {
        if (outflow.outflowType.eqn(OutflowType.UTXO)) {
          utxoHashes.push(outflow.note)
        } else if (outflow.outflowType.eqn(OutflowType.WITHDRAWAL)) {
          if (!outflow.data) throw Error('Withdrawal should have public data')
          withdrawalHashes.push({
            noteHash: outflow.note,
            withdrawalHash: Withdrawal.withdrawalHash(
              outflow.note,
              outflow.data,
            ),
          })
        }
      }
    }
    const myUtxoList = await this.db.read(prisma =>
      prisma.utxo.findMany({
        where: {
          hash: { in: utxoHashes.map(output => output.toString(10)) },
          treeId: null,
        },
      }),
    )
    const myWithdrawalList = await this.db.read(prisma =>
      prisma.withdrawal.findMany({
        where: {
          hash: { in: withdrawalHashes.map(h => h.noteHash.toString(10)) },
          treeId: null,
        },
      }),
    )
    const shouldTrack: { [key: string]: boolean } = {}
    for (const myNote of myUtxoList) {
      shouldTrack[myNote.hash] = true
    }
    for (const myNote of myWithdrawalList) {
      shouldTrack[myNote.hash] = true
    }
    for (const output of utxoHashes) {
      const trackThisNote = shouldTrack[output.toString(10)]
      utxos.push({
        hash: output,
        shouldTrack: !!trackThisNote,
      })
    }
    for (const hash of withdrawalHashes) {
      const keepTrack = shouldTrack[hash.noteHash.toString(10)]
      withdrawals.push({
        hash: hash.withdrawalHash.toBN(),
        noteHash: hash.noteHash,
        shouldTrack: !!keepTrack,
      })
    }
    for (const tx of block.body.txs) {
      for (const inflow of tx.inflow) {
        nullifiers.push(inflow.nullifier)
      }
    }
    return {
      header,
      utxos,
      withdrawals,
      nullifiers,
    }
  }

  async getTokenRegistry(): Promise<TokenRegistry> {
    const newRegistrations = await this.db.read(prisma =>
      prisma.tokenRegistry.findMany({
        where: {
          blockNumber: { gte: this.tokenRegistry.blockNumber },
        },
      }),
    )
    newRegistrations.forEach(registration => {
      const tokenAddress = Address.from(registration.address)
      if (
        registration.isERC20 &&
        !this.tokenRegistry.erc20s.find(addr => addr.eq(tokenAddress))
      ) {
        this.tokenRegistry.addERC20(tokenAddress)
      } else if (
        registration.isERC721 &&
        !this.tokenRegistry.erc721s.find(addr => addr.eq(tokenAddress))
      ) {
        this.tokenRegistry.addERC721(tokenAddress)
      }
      if (registration.blockNumber > this.tokenRegistry.blockNumber)
        this.tokenRegistry.blockNumber = registration.blockNumber
    })
    return this.tokenRegistry
  }
}
