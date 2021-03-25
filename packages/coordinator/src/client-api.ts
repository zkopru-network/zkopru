import { Bytes32 } from 'soltypes'
import { Block } from '@zkopru/core'
import { CoordinatorContext } from './context'
import EthMethods from './eth-rpc-methods'

export enum RpcMethod {
  address = 'l1_address',
  vks = 'l1_getVKs',
  syncing = 'l2_syncing',
  blockCount = 'l2_blockCount',
  blockNumber = 'l2_blockNumber',
  blockByIndex = 'l2_getBlockByIndex',
  blockByNumber = 'l2_getBlockByNumber',
  blockByHash = 'l2_getBlockByHash',
  transactionByHash = 'l2_getTransactionByHash',
  registeredTokens = 'l2_getRegisteredTokens',
}

export class ClientApi {
  context: CoordinatorContext

  rpcMethods: { [key: string]: Function }

  constructor(context: CoordinatorContext) {
    this.context = context
    /* eslint-disable @typescript-eslint/camelcase */
    this.rpcMethods = {
      l1_address: this.getAddress.bind(this),
      l1_getVKs: this.getVKs.bind(this),
      l2_syncing: this.syncing.bind(this),
      l2_blockCount: this.blockCount.bind(this),
      l2_blockNumber: this.blockNumber.bind(this),
      l2_getBlockByIndex: this.getBlockByIndex.bind(this),
      l2_getBlockByNumber: this.getBlockByNumber.bind(this),
      l2_getBlockByHash: this.getBlockByHash.bind(this),
      l2_getTransactionByHash: this.getTransactionByHash.bind(this),
      l2_getRegisteredTokens: this.getRegisteredTokens.bind(this),
    }
    /* eslint-enable @typescript-eslint/camelcase */
  }

  async callMethod(
    method: string,
    params: any[] = [],
    id: string | number,
    jsonrpc: string,
  ) {
    if (this.rpcMethods[method]) return this.rpcMethods[method](...params)
    if (EthMethods.indexOf(method) !== -1) {
      const provider = this.context.node.layer1.web3.currentProvider
      if (
        !provider ||
        typeof provider === 'string' ||
        typeof provider.send !== 'function'
      )
        throw new Error('Unable to proxy')
      return new Promise((rs, rj) =>
        (provider as any).send(
          {
            id,
            method,
            params,
            jsonrpc,
          },
          (err, data) => {
            if (err) return rj(err)
            if (data.error) return rj(data.error)
            rs(data.result)
          },
        ),
      )
    }
    throw new Error(`Invalid method: "${method}"`)
  }

  private async syncing() {
    return !this.context.node.synchronizer.isSynced()
  }

  private async getAddress() {
    return this.context.node.layer1.address
  }

  private async getVKs() {
    return this.context.node.layer1.getVKs()
  }

  private async blockCount(): Promise<number> {
    const latestBlockHash = await this.context.node.layer2.latestBlock()
    const latestBlock = await this.context.node.layer2.getProposal(
      latestBlockHash,
    )
    if (!latestBlock) throw new Error(`Unable to find hash: ${latestBlockHash}`)
    if (typeof latestBlock.proposalNum !== 'number') {
      throw new Error('Latest block does not include proposal number')
    }
    return latestBlock.proposalNum
  }

  private async blockNumber(): Promise<number> {
    if (!this.context.node.synchronizer.isSynced()) {
      throw new Error(`Node is not synced`)
    }
    const latestBlockHash = await this.context.node.layer2.latestBlock()
    const latestBlock = await this.context.node.layer2.getProposal(
      latestBlockHash,
    )
    if (!latestBlock) throw new Error(`Unable to find hash: ${latestBlockHash}`)
    if (typeof latestBlock.canonicalNum !== 'number') {
      throw new Error('Latest block does not include canonical number')
    }
    return latestBlock.canonicalNum
  }

  private async getBlockByNumber(
    _blockNumber: number | string,
    includeUncles = false,
  ) {
    let blockNumber = +_blockNumber
    if (_blockNumber === 'latest') {
      blockNumber = await this.blockNumber()
    }
    if (Number.isNaN(blockNumber)) {
      throw new Error('Supplied block number is not a number')
    }
    const [proposal, uncleCount, uncles] = await Promise.all([
      this.context.node.layer2.getProposalByCanonicalNumber(blockNumber, false),
      includeUncles
        ? Promise.resolve(0)
        : this.context.node.db.count('Proposal', {
            canonicalNum: blockNumber,
            isUncle: true,
          }),
      !includeUncles
        ? Promise.resolve([])
        : this.context.node.db.findMany('Proposal', {
            where: { canonicalNum: blockNumber, isUncle: true },
          }),
    ])
    if (!proposal) throw new Error('Unable to find block')
    const blockFromProposal = p => ({
      ...p,
      ...(p.proposalData ? Block.fromTx(JSON.parse(p.proposalData)) : {}),
      proposalData: undefined,
    })
    return {
      ...blockFromProposal(proposal),
      ...(includeUncles
        ? {
            uncles: (uncles || []).map(p => blockFromProposal(p)),
          }
        : {
            uncleCount,
          }),
    }
  }

  private async getBlockByIndex(_blockIndex: number | string) {
    let blockIndex = +_blockIndex
    if (_blockIndex === 'latest') {
      blockIndex = await this.blockCount()
    }
    if (Number.isNaN(blockIndex)) {
      throw new Error('Supplied block index is not a number')
    }
    const proposal = await this.context.node.layer2.getProposalByNumber(
      blockIndex,
      false,
    )
    if (!proposal) throw new Error('Unable to find block')
    const block = proposal.proposalData
      ? Block.fromTx(JSON.parse(proposal.proposalData))
      : {}
    return {
      ...proposal,
      ...block,
      proposalData: undefined, // don't send proposal data
    }
  }

  private async getBlockByHash(_hash: string | Bytes32) {
    let hash = _hash
    if (hash === 'latest') {
      hash = await this.context.node.layer2.latestBlock()
    }
    const proposal = await this.context.node.layer2.getProposal(
      new Bytes32(hash.toString()),
      false,
    )
    if (!proposal) throw new Error('Unable to find block')
    const block = proposal.proposalData
      ? Block.fromTx(JSON.parse(proposal.proposalData))
      : {}
    return {
      ...proposal,
      ...block,
      proposalData: undefined, // don't send proposal data
    }
  }

  private async getTransactionByHash(hash: string) {
    const { blockHash } =
      (await this.context.node.layer2.getTxByHash(hash)) || {}
    if (!blockHash) throw new Error('Unable to find transaction')
    const block = await this.context.node.layer2.getBlock(
      new Bytes32(blockHash),
    )
    if (!block) throw new Error('Unable to find block')
    const tx = block.body.txs.find(t => t.hash().toString() === hash)
    if (!tx) throw new Error('Unable to find tx in block')
    return {
      blockHash,
      ...tx.toJSON(),
    }
  }

  private async getRegisteredTokens() {
    return this.context.node.layer2.getTokenRegistry()
  }
}
