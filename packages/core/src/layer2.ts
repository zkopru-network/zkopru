import {
  DB,
  Deposit as DepositSql,
  Config,
  BlockStatus,
  Proposal,
  MassDeposit as MassDepositSql,
  Note as NoteSql,
  NoteType,
} from '@zkopru/prisma'
import { Grove, GrovePatch, Item } from '@zkopru/tree'
import BN from 'bn.js'
import AsyncLock from 'async-lock'
import { Bytes32, Address, Uint256 } from 'soltypes'
import { logger } from '@zkopru/utils'
import { Field } from '@zkopru/babyjubjub'
import { Note, OutflowType, UtxoStatus, ZkTx } from '@zkopru/transaction'
import { ZkAccount } from '@zkopru/account'
import {
  Block,
  Header,
  VerifyResult,
  MassDeposit,
  massDepositHash,
} from './block'
import { BootstrapData } from './bootstrap'

export interface Patch {
  result: VerifyResult
  block: Bytes32
  massDeposits?: Bytes32[]
  treePatch?: GrovePatch
  nullifiers?: Uint256[]
}

export class L2Chain {
  config: Config

  lock: AsyncLock

  grove: Grove

  db: DB

  constructor(db: DB, grove: Grove, config: Config) {
    this.db = db
    this.grove = grove
    this.config = config
    this.lock = new AsyncLock()
  }

  async getBlock(hash: Bytes32): Promise<Block | null> {
    const proposal = await this.db.read(prisma =>
      prisma.proposal.findOne({
        where: {
          hash: hash.toString(),
        },
        include: {
          block: true,
        },
      }),
    )
    if (!proposal || !proposal.proposalData) return null
    const tx = JSON.parse(proposal.proposalData)
    return Block.fromTx(tx, proposal.block?.verified || false)
  }

  async getProposal(hash: Bytes32) {
    const proposal = await this.db.read(prisma =>
      prisma.proposal.findOne({
        where: {
          hash: hash.toString(),
        },
        include: {
          block: true,
        },
      }),
    )
    return proposal
  }

  async getLatestVerified(): Promise<string | null> {
    const lastVerifiedProposal: Proposal | undefined = (
      await this.db.read(prisma =>
        prisma.proposal.findMany({
          where: {
            block: {
              verified: true,
            },
          },
          orderBy: {
            proposalNum: 'desc',
          },
          include: {
            block: {
              include: {
                header: true,
              },
            },
          },
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
            merged: massDeposit.merged.toString(),
            fee: massDeposit.fee.toString(),
            includedIn: null,
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
        logger.info('faield to find mass deposit')
        logger.info(massDeposit.merged.toString())
        logger.info(`fee ${massDeposit.fee.toString()}`)
        throw Error('Failed to find the mass deposit')
      }

      const deposits = await this.db.read(prisma =>
        prisma.deposit.findMany({
          where: {
            queuedAt: nonIncludedMassDepositCommit.index,
          },
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

  async getOldestUnverifiedBlock(): Promise<{
    prevHeader?: Header
    block?: Block
  }> {
    const lastVerified = await this.getLatestVerified()
    if (!lastVerified) return {}

    const unverifiedProposals = await this.db.read(prisma =>
      prisma.proposal.findMany({
        where: {
          block: { header: { parentBlock: lastVerified }, verified: null },
        },
        orderBy: { proposalNum: 'asc' },
        take: 1,
        include: { block: true },
      }),
    )
    const unverifiedProposal = unverifiedProposals.pop()

    if (!unverifiedProposal || !unverifiedProposal.proposalData) return {}

    const lastVerifiedHeader = await this.db.read(prisma =>
      prisma.header.findOne({
        where: { hash: lastVerified },
      }),
    )
    if (!lastVerifiedHeader) throw Error('Header not exist error.')
    const prevHeader = {
      proposer: Address.from(lastVerifiedHeader.proposer),
      parentBlock: Bytes32.from(lastVerifiedHeader.parentBlock),
      metadata: Bytes32.from(lastVerifiedHeader.metadata),
      fee: Uint256.from(lastVerifiedHeader.fee),
      utxoRoot: Uint256.from(lastVerifiedHeader.utxoRoot),
      utxoIndex: Uint256.from(lastVerifiedHeader.utxoIndex),
      nullifierRoot: Bytes32.from(lastVerifiedHeader.nullifierRoot),
      withdrawalRoot: Bytes32.from(lastVerifiedHeader.withdrawalRoot),
      withdrawalIndex: Uint256.from(lastVerifiedHeader.withdrawalIndex),
      txRoot: Bytes32.from(lastVerifiedHeader.txRoot),
      depositRoot: Bytes32.from(lastVerifiedHeader.depositRoot),
      migrationRoot: Bytes32.from(lastVerifiedHeader.migrationRoot),
    }
    const tx = JSON.parse(unverifiedProposal.proposalData)
    const block = Block.fromTx(tx)
    return {
      prevHeader,
      block,
    }
  }

  async applyPatchAndMarkAsVerified(patch: Patch) {
    logger.info('layer2.ts: applyPatch()')
    const { result, block, treePatch, massDeposits } = patch
    // Apply tree patch
    if (treePatch) {
      if (result === VerifyResult.INVALIDATED)
        throw Error('Invalid result cannot make a patch')
      await this.grove.applyPatch(treePatch)
      await this.nullifyNotes(block, treePatch.nullifiers)
    }
    // Record the verify result
    if (result === VerifyResult.INVALIDATED) {
      await this.db.write(prisma =>
        prisma.proposal.update({
          where: { hash: block.toString() },
          data: { invalidated: true },
        }),
      )
    } else {
      if (!patch) throw Error('patch does not exists')
      await this.db.write(prisma =>
        prisma.block.update({
          where: { hash: block.toString() },
          data: { verified: true },
        }),
      )
    }
    // Update mass deposits inclusion status
    if (massDeposits) {
      await this.markMassDepositsAsIncludedIn(massDeposits, block)
    }
  }

  async findMyNotes(txs: ZkTx[], utxos: Item<Field>[], accounts: ZkAccount[]) {
    const txsWithMemo = txs.filter(tx => tx.memo)
    logger.info(`findMyNotes`)
    const myNotes: Note[] = []
    for (const tx of txsWithMemo) {
      for (const account of accounts) {
        const note = account.decrypt(tx)
        logger.info(`decrypt result ${note}`)
        if (note) myNotes.push(note)
      }
    }
    // TODO needs batch transaction
    for (const note of myNotes) {
      const noteSql = {
        hash: note
          .hash()
          .toUint256()
          .toString(),
        eth: note.eth.toUint256().toString(),
        pubKey: Bytes32.from(note.pubKey.toHex()).toString(),
        salt: note.salt.toUint256().toString(),
        tokenAddr: note.tokenAddr.toAddress().toString(),
        erc20Amount: note.erc20Amount.toUint256().toString(),
        nft: note.nft.toUint256().toString(),
        status: UtxoStatus.UNSPENT,
        noteType: NoteType.UTXO,
        usedFor: null,
      }
      await this.db.write(prisma =>
        prisma.note.upsert({
          where: { hash: noteSql.hash },
          create: noteSql,
          update: noteSql,
        }),
      )
    }
    await this.db.write(prisma =>
      prisma.note.updateMany({
        where: {
          hash: { in: utxos.map(utxo => utxo.leafHash.toUint256().toString()) },
        },
        data: { status: UtxoStatus.UNSPENT },
      }),
    )
  }

  async applyBootstrap(block: Block, bootstrapData: BootstrapData) {
    this.grove.applyBootstrap(bootstrapData)
    const blockSql = { ...block.toSqlObj(), status: BlockStatus.FINALIZED }
    const headerSql = block.getHeaderSql()
    this.db.write(prisma =>
      prisma.block.upsert({
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
    if (indexes.length !== massDepositHashes.length)
      throw Error('Number of MassDeposits is different with the block proposal')
    await this.db.write(prisma =>
      prisma.massDeposit.updateMany({
        where: { index: { in: indexes } },
        data: { includedIn: block.toString() },
      }),
    )
  }

  private async nullifyNotes(blockHash: Bytes32, nullifiers: BN[]) {
    await this.db.write(prisma =>
      prisma.note.updateMany({
        where: { nullifier: { in: nullifiers.map(v => v.toString()) } },
        data: {
          status: UtxoStatus.SPENT,
          usedFor: blockHash.toString(),
        },
      }),
    )
  }

  async getGrovePatch(block: Block): Promise<GrovePatch> {
    logger.info(`get grove patch for block ${block.hash.toString()}`)
    const header = block.hash.toString()
    const utxos: Item<Field>[] = []
    const withdrawals: BN[] = []
    const nullifiers: BN[] = []

    const deposits = await this.getDeposits(...block.body.massDeposits)
    utxos.push(
      ...deposits.map(deposit => ({
        leafHash: Field.from(deposit.note),
      })),
    )

    const utxoHashes: Field[] = []
    for (const tx of block.body.txs) {
      for (const outflow of tx.outflow) {
        if (outflow.outflowType.eqn(OutflowType.UTXO)) {
          utxoHashes.push(outflow.note)
        } else if (outflow.outflowType.eqn(OutflowType.WITHDRAWAL)) {
          withdrawals.push(outflow.note)
        }
      }
    }
    const myNoteList = await this.db.read(prisma =>
      prisma.note.findMany({
        where: {
          hash: { in: utxoHashes.map(output => output.toHex()) },
          treeId: null,
        },
      }),
    )
    const myNotes: { [key: string]: NoteSql } = {}
    for (const myNote of myNoteList) {
      myNotes[myNote.hash] = myNote
    }
    for (const output of utxoHashes) {
      const myNote = myNotes[output.toHex()]
      utxos.push({
        leafHash: output,
        note: myNote ? Note.fromSql(myNote) : undefined,
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
}
