import {
  DB,
  Deposit as DepositSql,
  Config,
  Proposal,
  MassDeposit as MassDepositSql,
} from '@zkopru/database'
import { Grove, GrovePatch, Leaf } from '@zkopru/tree'
import AsyncLock from 'async-lock'
import { Bytes32, Address, Uint256 } from 'soltypes'
import { logger, mergeDeposits } from '@zkopru/utils'
import { Fp } from '@zkopru/babyjubjub'
import {
  OutflowType,
  Withdrawal,
  TokenRegistry,
  ZkTx,
} from '@zkopru/transaction'
import { BigNumber } from 'ethers'
import { Block, Header, MassDeposit } from '../block'
import { BootstrapData } from '../node/bootstrap'
import { SNARKVerifier, VerifyingKey } from '../snark/snark-verifier'
import { massDepositHash } from '../block/utils'

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
    logger.trace(`core/layer2.ts - L2Chain::constructor()`)
    this.db = db
    this.grove = grove
    this.config = config
    this.snarkVerifier = new SNARKVerifier(vks)
    this.tokenRegistry = new TokenRegistry()
    this.lock = new AsyncLock()
  }

  async latestBlock(): Promise<Bytes32> {
    logger.trace(`core/layer2.ts - L2Chain::latestBlock()`)
    const lastVerifiedProposal = await this.db.findOne('Proposal', {
      where: {
        verified: true,
        isUncle: null,
      },
      orderBy: { proposalNum: 'desc' },
      include: { block: { header: true } },
    })
    if (!lastVerifiedProposal) throw Error('no verified proposal')
    return Bytes32.from(lastVerifiedProposal.hash)
  }

  async getBlockByNumber(blockNum: number): Promise<Block | null> {
    logger.trace(`core/layer2.ts - L2Chain::getBlockByNumber(${blockNum})`)
    const proposals = await this.db.findMany('Proposal', {
      where: {
        proposalNum: blockNum,
      },
      include: { block: true },
    })
    if (proposals.length === 0) return null
    const [proposal] = proposals as [Proposal & { block: Block | null }]
    if (proposal.proposalNum === 0) {
      // load the genesis block
      const header = await this.db.findOne('Header', {
        where: {
          hash: proposal.hash,
        },
      })
      return new Block({
        hash: Bytes32.from(proposal.hash),
        verified: proposal.verified === null ? undefined : proposal.verified,
        header,
        body: {
          txs: [],
          massDeposits: [],
          massMigrations: [],
        },
      })
    }
    if (typeof proposal.proposalData !== 'string') return null
    const tx = JSON.parse(proposal.proposalData)
    return Block.fromTx(tx, proposal.verified || false)
  }

  async getBlock(hash: Bytes32): Promise<Block | null> {
    logger.trace(
      `core/layer2.ts - L2Chain::getBlock(${hash.toString().slice(0, 6)}...)`,
    )
    const proposal = await this.db.findOne('Proposal', {
      where: {
        hash: hash.toString(),
      },
      include: { block: true },
    })
    if (proposal && proposal.proposalNum === 0) {
      // load the genesis block
      const header = await this.db.findOne('Header', {
        where: {
          hash: proposal.hash,
        },
      })
      return new Block({
        hash: Bytes32.from(proposal.hash),
        verified: proposal.verified === null ? undefined : proposal.verified,
        header,
        body: {
          txs: [],
          massDeposits: [],
          massMigrations: [],
        },
      })
    }
    if (!proposal || !proposal.proposalData) return null
    const tx = JSON.parse(proposal.proposalData)
    return Block.fromTx(tx, proposal.verified || false)
  }

  async getProposalByNumber(proposalNum: number, includeBlock = true) {
    logger.trace(
      `core/layer2.ts - L2Chain::getProposalByNumber(${proposalNum})`,
    )
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
    logger.trace(
      `core/layer2.ts - L2Chain::getProposalByCanonicalNumber(${canonicalNum})`,
    )
    const proposals = await this.db.findMany('Proposal', {
      where: { canonicalNum },
      include: { block: includeBlock },
    })
    if (proposals.length === 0) return null
    const [proposal] = proposals
    return proposal
  }

  async getProposal(hash: Bytes32, includeBlock = true) {
    logger.trace(
      `core/layer2.ts - L2Chain::getProposal(${hash
        .toString()
        .slice(0, 6)}...)`,
    )
    const proposal = await this.db.findOne('Proposal', {
      where: { hash: hash.toString() },
      include: { block: includeBlock },
    })
    return proposal
  }

  async getTxByHash(hash: string | Bytes32) {
    logger.trace(
      `core/layer2.ts - L2Chain::getTxByHash(${hash
        .toString()
        .slice(0, 6)}...)`,
    )
    return this.db.findOne('Tx', {
      where: { hash: hash.toString() },
    })
  }

  async getDeposits(...massDeposits: MassDeposit[]): Promise<DepositSql[]> {
    logger.trace(
      `core/layer2.ts - L2Chain::getDeposits(${massDeposits.map(md =>
        massDepositHash(md)
          .toString()
          .slice(0, 6),
      )}})`,
    )
    if (massDeposits.length === 0) return []
    // TODO: actually optimize OR queries
    const massDepositsByMerged = massDeposits.reduce((acc, obj) => {
      return {
        ...acc,
        [obj.merged.toString()]: obj,
      }
    }, {})
    const massDepositObjects = await this.db.findMany('MassDeposit', {
      where: {
        merged: massDeposits.map(({ merged }) => merged.toString()),
      },
      orderBy: {
        blockNumber: 'asc',
      },
    })
    if (massDepositObjects.length !== massDeposits.length) {
      for (const { merged, fee } of massDeposits) {
        const i = massDepositObjects.findIndex(
          massDeposit => merged.toString() === massDeposit.merged,
        )
        // eslint-disable-next-line no-continue
        if (i !== -1) continue
        logger.info(`core/layer2.ts - ${merged.toString()}`)
        logger.info(`core/layer2.ts - fee ${fee.toString()}`)
      }
      throw Error('Failed to find the mass deposit')
    }
    for (const obj of massDepositObjects) {
      if (
        !massDepositsByMerged[obj.merged] ||
        massDepositsByMerged[obj.merged].fee.toString() !== obj.fee
      ) {
        throw new Error('Deposit fee mismatch')
      }
    }
    const deposits = await this.db.findMany('Deposit', {
      where: {
        queuedAt: massDepositObjects.map(({ index }) => index),
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

  async getPendingMassDeposits(): Promise<PendingMassDeposits> {
    const leaves: Fp[] = []
    let aggregatedFee: Fp = Fp.zero
    // 1. pick mass deposits
    const commits: MassDepositSql[] = await this.db.findMany('MassDeposit', {
      where: { includedIn: null },
      orderBy: { blockNumber: 'asc' },
      limit: 255,
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
      if (a.logIndex === b.logIndex) {
        throw new Error('Deposits must be ordered')
      }
      return a.logIndex - b.logIndex
    })
    leaves.push(...pendingDeposits.map(deposit => Fp.from(deposit.note)))
    aggregatedFee = aggregatedFee.add(
      pendingDeposits.reduce((prev, item) => prev.add(item.fee), Fp.zero),
    )
    const includedIndexes = {}
    const validLeaves = [] as Fp[]
    for (const commit of commits) {
      const deposits = pendingDeposits.filter(deposit => {
        return deposit.queuedAt === commit.index
      })
      // If found missing deposit or no deposit in commits
      if (deposits.length === 0) {
        logger.trace(`core/context-layer2.ts - no deposit`)
        // eslint-disable-next-line no-continue
        continue
      }
      const { merged, fee } = mergeDeposits(deposits)
      if (
        merged.toString() !== commit.merged ||
        !Fp.from(fee.toString()).eq(Fp.from(commit.fee))
      ) {
        logger.trace(`core/context-layer2.ts - missing deposit in commits`)
        // eslint-disable-next-line no-continue
        continue
      }
      validLeaves.push(...deposits.map(deposit => Fp.from(deposit.note)))
      includedIndexes[commit.index] = true
    }
    const massDeposits = commits
      .filter(commit => includedIndexes[commit.index])
      .map(commit => ({
        merged: Bytes32.from(commit.merged),
        fee: Uint256.from(commit.fee),
      }))
    return {
      massDeposits,
      leaves: validLeaves,
      totalFee: commits.reduce((acc, commit) => {
        if (!includedIndexes[commit.index]) return acc
        return acc.add(Fp.from(commit.fee))
      }, Fp.zero),
      calldataSize: massDeposits.length ? massDeposits.length * 64 + 1 : 0,
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
      include: { block: { header: true, slash: true } },
    })
    const unprocessedProposal = unprocessedProposals.pop()
    if (
      !unprocessedProposal ||
      !unprocessedProposal.proposalData ||
      !unprocessedProposal.proposalNum
    )
      return

    logger.trace(
      `core/layer2.ts - unprocessed proposal: ${unprocessedProposal?.hash}`,
    )
    const parentHash = unprocessedProposal.block?.header.parentBlock
    if (!parentHash) throw Error('Its parent block is not processed yet')

    const parentHeader = await this.db.findOne('Header', {
      where: { hash: parentHash },
    })
    logger.trace(
      `core/validator.ts - last verified header: ${parentHeader?.hash}`,
    )
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
      block: Object.assign(block, {
        slashed: !!unprocessedProposal.block.slash,
      }),
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
    const blockHashes = headers.map(({ hash }) => hash)
    // TODO: use index when booleans are supported
    const canonical = await this.db.findMany('Proposal', {
      where: {
        hash: blockHashes,
      },
    })
    return (
      canonical.findIndex(p => p.verified && p.proposalNum < proposalNum) !== -1
    )
  }

  async isValidTx(zkTx: ZkTx): Promise<boolean> {
    // 1. verify snark
    const snarkResult = await this.snarkVerifier.verifyTx(zkTx)
    if (!snarkResult) return false

    // 2. try to find invalid outflow
    for (const outflow of zkTx.outflow) {
      if (outflow.outflowType.eq(OutflowType.UTXO)) {
        if (outflow.data !== undefined) return false
      } else if (outflow.outflowType.eq(OutflowType.MIGRATION)) {
        if (outflow.data === undefined) return false
        if (!outflow.data.nft.isZero()) return false // migration cannot have nft
        if (
          outflow.data.tokenAddr.isZero() &&
          !outflow.data.erc20Amount.isZero()
        )
          return false // migration cannot have nft
        if (!outflow.data.tokenAddr.isZero()) {
          const registeredInfo = await this.db.findOne('TokenRegistry', {
            where: { address: outflow.data.tokenAddr.toString() },
          })
          if (!registeredInfo) {
            return false
          }
          if (!registeredInfo.isERC20) {
            return false
          }
        }
      }
    }

    // 3. try to find invalid inflow
    const nullifiers = zkTx.inflow.map(({ nullifier }) => nullifier.toString())
    const utxos = await this.db.findMany('Utxo', {
      where: {
        nullifier: nullifiers,
        usedAt: { ne: null },
      },
    })
    if (utxos.length > 0) return false
    const keyedNullifiers = {}
    for (const nullifier of nullifiers) {
      if (keyedNullifiers[nullifier]) {
        return false
      }
      keyedNullifiers[nullifier] = true
    }
    return true
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
    logger.info(
      `core/layer2.ts - get grove patch for block ${block.hash.toString()}`,
    )
    const header = block.hash.toString()
    const utxos: Leaf<Fp>[] = []
    const withdrawals: Leaf<BigNumber>[] = []
    const nullifiers: Fp[] = []

    const deposits = await this.getDeposits(...block.body.massDeposits)
    const utxoHashes: Fp[] = []
    utxoHashes.push(...deposits.map(deposit => Fp.from(deposit.note)))

    const withdrawalHashes: { noteHash: Fp; withdrawalHash: Uint256 }[] = []
    for (const tx of block.body.txs) {
      for (const outflow of tx.outflow) {
        if (outflow.outflowType.eq(OutflowType.UTXO)) {
          utxoHashes.push(outflow.note)
        } else if (outflow.outflowType.eq(OutflowType.WITHDRAWAL)) {
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
        hash: utxoHashes.map(output => output.toString()),
        treeId: null,
      },
    })
    const myWithdrawalList = await this.db.findMany('Withdrawal', {
      where: {
        hash: withdrawalHashes.map(h => h.noteHash.toString()),
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
      const trackThisNote = shouldTrack[output.toString()]
      utxos.push({
        hash: output,
        shouldTrack: !!trackThisNote,
      })
    }
    for (const hash of withdrawalHashes) {
      const keepTrack = shouldTrack[hash.noteHash.toString()]
      withdrawals.push({
        hash: hash.withdrawalHash.toBigNumber(),
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
      },
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
