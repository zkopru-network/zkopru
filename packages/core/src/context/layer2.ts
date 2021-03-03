import {
  DB,
  Deposit as DepositSql,
  Config,
  Proposal,
  MassDeposit as MassDepositSql,
} from '@zkopru/database'
import { Grove, GrovePatch, Leaf } from '@zkopru/tree'
import BN from 'bn.js'
import AsyncLock from 'async-lock'
import { Bytes32, Address, Uint256 } from 'soltypes'
import { logger } from '@zkopru/utils'
import { Fp } from '@zkopru/babyjubjub'
import { OutflowType, Withdrawal, TokenRegistry } from '@zkopru/transaction'
import { Block, Header, MassDeposit } from '../block'
import { BootstrapData } from '../node/bootstrap'
import { SNARKVerifier, VerifyingKey } from '../snark/snark-verifier'

export interface Patch {
  block: Bytes32
  header: Header
  prevHeader: Header
  massDeposits?: Bytes32[]
  treePatch: GrovePatch
  nullifiers?: Uint256[]
}
export interface PendingMassDeposits {
  massDeposits: MassDeposit[]
  leaves: Fp[]
  totalFee: Fp
  calldataSize: number
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

  async latestBlock(): Promise<Bytes32> {
    const lastVerifiedProposal = await this.db.findOne('Proposal', {
      where: {
        verified: true,
        isUncle: null,
      },
      orderBy: { proposalNum: 'desc' },
      include: { block: { header: true }},
    })
    if (!lastVerifiedProposal) throw Error('no verified proposal')
    return Bytes32.from(lastVerifiedProposal.hash)
  }

  async getBlockByNumber(blockNum: number): Promise<Block | null> {
    const proposals = await this.db.findMany('Proposal', {
      where: {
        proposalNum: blockNum,
      },
      include: { block: true },
    })
    if (proposals.length === 0) return null
    const [proposal] = proposals as [Proposal & { block: Block | null }]
    if (typeof proposal.proposalData !== 'string') return null
    const tx = JSON.parse(proposal.proposalData)
    return Block.fromTx(tx, proposal.verified || false)
  }

  async getBlock(hash: Bytes32): Promise<Block | null> {
    const proposal = await this.db.findOne('Proposal', {
      where: {
        hash: hash.toString(),
      },
      include: { block: true },
    })
    if (!proposal || !proposal.proposalData) return null
    const tx = JSON.parse(proposal.proposalData)
    return Block.fromTx(tx, proposal.verified || false)
  }

  async getProposalByNumber(proposalNum: number, includeBlock = true) {
    const proposals = await this.db.findMany('Proposal', {
      where: { proposalNum },
      include: { block: includeBlock },
    })
    if (proposals.length === 0) return null
    const [proposal] = proposals
    return proposal
  }

  async getProposalByCanonicalNumber(
    canonicalNum: number,
    includeBlock = true,
  ) {
    const proposals = await this.db.findMany('Proposal', {
      where: { canonicalNum },
      include: { block: includeBlock },
    })
    if (proposals.length === 0) return null
    const [proposal] = proposals
    return proposal
  }

  async getProposal(hash: Bytes32, includeBlock = true) {
    const proposal = await this.db.findOne('Proposal', {
      where: { hash: hash.toString() },
      include: { block: includeBlock },
    })
    return proposal
  }

  async getTxByHash(hash: string | Bytes32) {
    return this.db.findOne('Tx', {
      where: { hash: hash.toString() },
    })
  }

  async getDeposits(...massDeposits: MassDeposit[]): Promise<DepositSql[]> {
    const totalDeposits: DepositSql[] = []
    for (const massDeposit of massDeposits) {
      const commits = await this.db.findMany('MassDeposit', {
        where: {
          merged: massDeposit.merged.toString(),
          fee: massDeposit.fee.toString(),
        },
        orderBy: {
          blockNumber: 'asc',
        },
        limit: 1,
      })
      // logger.info()
      const nonIncludedMassDepositCommit = commits.pop()
      if (!nonIncludedMassDepositCommit) {
        logger.info(massDeposit.merged.toString())
        logger.info(`fee ${massDeposit.fee.toString()}`)
        throw Error('Failed to find the mass deposit')
      }

      const deposits = await this.db.findMany('Deposit', {
        where: { queuedAt: nonIncludedMassDepositCommit.index },
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
      totalDeposits.push(...deposits)
    }
    return totalDeposits
  }

  async getPendingMassDeposits(): Promise<PendingMassDeposits> {
    const leaves: Fp[] = []
    let consumedBytes = 0
    let aggregatedFee: Fp = Fp.zero
    // 1. pick mass deposits
    const commits: MassDepositSql[] = await this.db.findMany('MassDeposit', {
      where: { includedIn: null },
    })
    commits.sort((a, b) => parseInt(a.index, 10) - parseInt(b.index, 10))
    const pendingDeposits = await this.db.findMany('Deposit', {
      where: { queuedAt: commits.map(commit => commit.index) },
    })
    pendingDeposits.sort((a, b) => {
      if (a.blockNumber !== b.blockNumber) {
        return a.blockNumber - b.blockNumber
      }
      if (a.transactionIndex !== b.transactionIndex) {
        return a.transactionIndex - b.transactionIndex
      }
      // TODO HERE!!
      return a.logIndex - b.logIndex
    })
    leaves.push(...pendingDeposits.map(deposit => Fp.from(deposit.note)))
    consumedBytes += commits.length
    aggregatedFee = aggregatedFee.add(
      pendingDeposits.reduce((prev, item) => prev.add(item.fee), Fp.zero),
    )
    return {
      massDeposits: commits.map(commit => ({
        merged: Bytes32.from(commit.merged),
        fee: Uint256.from(commit.fee),
      })),
      leaves,
      totalFee: aggregatedFee,
      calldataSize: consumedBytes,
    }
  }

  async getOldestUnprocessedBlock(): Promise<
    | undefined
    | {
        parent: Header
        block: Block
        proposal: Proposal
      }
  > {
    const unprocessedProposals = await this.db.findMany('Proposal', {
      where: {
        verified: null,
        isUncle: null,
      },
      orderBy: { proposalNum: 'asc' },
      limit: 1,
      include: { block: { header: true } },
    })
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

    const parentHeader = await this.db.findOne('Header', {
      where: { hash: parentHash },
    })
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
    const headers = await this.db.findMany('Header', {
      where: {
        parentBlock: parentBlock.toString(),
      },
    })
    const blockHashes = headers
      .map(({ hash }) => hash)
    const canonical = await this.db.findMany('Proposal', {
      where: {
        verified: true,
        hash: blockHashes,
        proposalNum: { lt: proposalNum, }
      },
      orderBy: { proposalNum: 'asc' },
    })
    return canonical.length > 0
    // const canonical = await this.db.read(prisma =>
    //   prisma.proposal.findMany({
    //     where: {
    //       AND: [
    //         { proposalNum: { lt: proposalNum } },
    //         {
    //           block: {
    //             header: { parentBlock: { equals: parentBlock.toString() } },
    //           },
    //         },
    //         { verified: true },
    //       ],
    //     },
    //     orderBy: { proposalNum: 'asc' },
    //     take: 1,
    //   }),
    // )
    // return canonical.length === 1
  }

  async applyBootstrap(block: Block, bootstrapData: BootstrapData) {
    this.grove.applyBootstrap(bootstrapData)
    const blockSql = { ...block.toSqlObj() }
    const headerSql = block.getHeaderSql()
    const count = await this.db.count('Block', {
      hash: block.hash.toString(),
    })
    if (count > 0) return
    await this.db.create('Block', blockSql)
    await this.db.create('Proposal', bootstrapData.proposal)
    await this.db.create('Header', headerSql)
  }

  async getGrovePatch(block: Block): Promise<GrovePatch> {
    logger.info(`get grove patch for block ${block.hash.toString()}`)
    const header = block.hash.toString()
    const utxos: Leaf<Fp>[] = []
    const withdrawals: Leaf<BN>[] = []
    const nullifiers: Fp[] = []

    const deposits = await this.getDeposits(...block.body.massDeposits)
    const utxoHashes: Fp[] = []
    utxoHashes.push(...deposits.map(deposit => Fp.from(deposit.note)))

    const withdrawalHashes: { noteHash: Fp; withdrawalHash: Uint256 }[] = []
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
    const myUtxoList = await this.db.findMany('Utxo', {
      where: {
        hash: utxoHashes.map(output => output.toString(10)),
        treeId: null,
      },
    })
    const myWithdrawalList = await this.db.findMany('Withdrawal', {
      where: {
        hash: withdrawalHashes.map(h => h.noteHash.toString(10)),
        treeId: null,
      },
    })
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
    const newRegistrations = await this.db.findMany('TokenRegistry', {
      where: {
        blockNumber: { gte: this.tokenRegistry.blockNumber },
      }
    })
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
