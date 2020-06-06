import {
  DB,
  Deposit as DepositSql,
  Config,
  BlockStatus,
  Proposal,
} from '@zkopru/prisma'
import { Grove, GrovePatch } from '@zkopru/tree'
import AsyncLock from 'async-lock'
import { Bytes32 } from 'soltypes'
import { logger } from '@zkopru/utils'
import { Block, Header, VerifyResult, MassDeposit } from './block'
import { BootstrapData } from './bootstrap'

export interface Patch {
  result: VerifyResult
  block: Bytes32
  massDeposits?: Bytes32[]
  treePatch?: GrovePatch
}

export class L2Chain {
  config: Config

  lock: AsyncLock

  grove: Grove

  db: DB

  latest?: string

  constructor(db: DB, grove: Grove, config: Config) {
    this.db = db
    this.grove = grove
    this.config = config
    this.lock = new AsyncLock()
  }

  async getBlock(hash: Bytes32): Promise<Block | null> {
    const proposal = await this.db.prisma.proposal.findOne({
      where: {
        hash: hash.toString(),
      },
      include: {
        block: true,
      },
    })
    if (!proposal || !proposal.proposalData) return null
    const tx = JSON.parse(proposal.proposalData)
    return Block.fromTx(tx, proposal.block?.verified || false)
  }

  async getLatestVerifiedBlock(): Promise<Block | null> {
    const lastVerifiedProposal: Proposal | undefined = (
      await this.db.prisma.proposal.findMany({
        where: {
          block: {
            verified: true,
          },
        },
        orderBy: {
          proposalNum: 'desc',
        },
        include: {
          block: true,
        },
        take: 1,
      })
    ).pop()
    if (lastVerifiedProposal && lastVerifiedProposal.proposalData) {
      const tx = JSON.parse(lastVerifiedProposal.proposalData)
      return Block.fromTx(tx)
    }
    return null
  }

  async getLatestBlockHash(): Promise<Bytes32 | null> {
    const lastVerified = await this.getLatestVerifiedBlock()
    return lastVerified ? lastVerified.hash : null
  }

  async getDeposits(massDeposit: MassDeposit): Promise<DepositSql[]> {
    const commits = await this.db.prisma.massDeposit.findMany({
      where: {
        merged: massDeposit.merged.toString(),
        fee: massDeposit.fee.toString(),
        includedIn: null,
      },
      orderBy: {
        blockNumber: 'asc',
      },
      take: 1,
    })
    const nonIncludedMassDepositCommit = commits.pop()
    if (!nonIncludedMassDepositCommit)
      throw Error('Failed to find the mass deposit')

    const deposits = await this.db.prisma.deposit.findMany({
      where: {
        queuedAt: nonIncludedMassDepositCommit.index,
      },
    })
    deposits.sort((a, b) => {
      if (a.blockNumber !== b.blockNumber) {
        return a.blockNumber - b.blockNumber
      }
      if (a.transactionIndex !== b.transactionIndex) {
        return a.transactionIndex - b.transactionIndex
      }
      return a.logIndex - b.logIndex
    })
    return deposits
  }

  async getOldestUnverifiedBlock(): Promise<{
    prevHeader?: Header
    block?: Block
  }> {
    const lastVerified = await this.getLatestVerifiedBlock()
    if (!lastVerified) return {}

    const prevHeader = lastVerified?.header
    const unverifiedProposals = await this.db.prisma.proposal.findMany({
      where: {
        block: {
          header: {
            parentBlock: lastVerified.hash.toString(),
          },
          verified: null,
        },
      },
      orderBy: {
        proposalNum: 'asc',
      },
      take: 1,
      include: {
        block: true,
      },
    })
    const unverifiedProposal = unverifiedProposals.pop()

    if (!unverifiedProposal || !unverifiedProposal.proposalData) return {}

    const tx = JSON.parse(unverifiedProposal.proposalData)
    const block = Block.fromTx(tx)
    return {
      prevHeader,
      block,
    }
  }

  async applyPatch(patch: Patch) {
    logger.info('layer2.ts: applyPatch()')
    const { result, block, treePatch, massDeposits } = patch
    // Apply tree patch
    if (treePatch) {
      if (result === VerifyResult.INVALIDATED)
        throw Error('Invalid result cannot make a patch')
      await this.grove.applyPatch(treePatch)
    }
    // Record the verify result
    if (result === VerifyResult.INVALIDATED) {
      await this.db.prisma.proposal.update({
        where: { hash: block.toString() },
        data: { invalidated: true },
      })
    } else {
      if (!patch) throw Error('patch does not exists')
      await this.db.prisma.block.update({
        where: { hash: block.toString() },
        data: { verified: true },
      })
    }
    // Update mass deposits inclusion status
    if (massDeposits) {
      await this.markMassDepositsAsIncludedIn(massDeposits, block)
    }
  }

  async applyBootstrap(block: Block, bootstrapData: BootstrapData) {
    this.grove.applyBootstrap(bootstrapData)
    const blockSql = { ...block.toSqlObj(), status: BlockStatus.FINALIZED }
    const headerSql = block.getHeaderSql()
    this.db.prisma.block.upsert({
      where: {
        hash: block.hash.toString(),
      },
      update: blockSql,
      create: {
        ...blockSql,
        proposal: {
          create: bootstrapData.proposal,
        },
        header: {
          create: headerSql,
        },
      },
    })
  }

  async finalize(hash: Bytes32) {
    await this.db.prisma.proposal.update({
      where: { hash: hash.toString() },
      data: { finalized: true },
    })
  }

  private async markMassDepositsAsIncludedIn(ids: Bytes32[], block: Bytes32) {
    await this.db.prisma.massDeposit.updateMany({
      where: {
        index: {
          in: ids.map(val => val.toString()),
        },
      },
      data: {
        includedIn: block.toString(),
      },
    })
  }
}
