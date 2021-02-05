import { Bytes32 } from 'soltypes'
import { CoordinatorContext } from './context'
import EthMethods from './eth-rpc-methods'

export class ClientApi {
  context: CoordinatorContext

  rpcMethods: { [key: string]: Function }

  constructor(context: CoordinatorContext) {
    this.context = context
    /* eslint-disable @typescript-eslint/camelcase */
    this.rpcMethods = {
      l1_address: this.getAddress.bind(this),
      l1_getVKs: this.getVKs.bind(this),
      l2_blockNumber: this.blockNumber.bind(this),
      l2_getBlockByNumber: this.getBlockByNumber.bind(this),
      l2_getBlockByHash: this.getBlockByHash.bind(this),
      l2_getProposalByHash: this.getProposalByHash.bind(this),
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
            rs(data)
          },
        ),
      )
    }
    throw new Error(`Invalid method: "${method}"`)
  }

  private async getAddress() {
    return this.context.node.layer1.address
  }

  private async getVKs() {
    const VKs = await this.context.node.layer1.getVKs()
    return JSON.parse(
      JSON.stringify(VKs, (_, value) => {
        if (typeof value === 'bigint') {
          return value.toString()
        }
        return value
      }),
    )
  }

  private async getProposalByHash(_hash: string | Bytes32) {
    let hash = _hash
    if (hash === 'latest') {
      hash = await this.context.node.layer2.latestBlock()
    }
    return this.context.node.layer2.getProposal(new Bytes32(hash.toString()))
  }

  private async blockNumber(): Promise<number> {
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

  private async getBlockByNumber(_blockNumber: number | string) {
    let blockNumber = +_blockNumber
    if (_blockNumber === 'latest') {
      blockNumber = await this.blockNumber()
    }
    if (Number.isNaN(blockNumber)) {
      throw new Error('Supplied block number is not a number')
    }
    const block = await this.context.node.layer2.getBlockByNumber(blockNumber)
    if (!block) throw new Error('Unable to find block')
    return block
  }

  private async getBlockByHash(_hash: string | Bytes32) {
    let hash = _hash
    if (hash === 'latest') {
      hash = await this.context.node.layer2.latestBlock()
    }
    return this.context.node.layer2.getBlock(new Bytes32(hash.toString()))
  }

  private async getTransactionByHash(hash: string) {
    return this.context.node.layer2.getTxByHash(hash)
  }

  private async getRegisteredTokens() {
    return this.context.node.layer2.getTokenRegistry()
  }
}
