import { CoordinatorContext } from './context'

export class ClientApi {
  context: CoordinatorContext

  rpcMethods: { [key: string]: Function }

  constructor(context: CoordinatorContext) {
    this.context = context
    /* eslint-disable @typescript-eslint/camelcase */
    this.rpcMethods = {
      l2_blockNumber: this.blockNumber.bind(this),
      l2_blockByNumber: this.getBlockByNumber.bind(this),
    }
    /* eslint-enable @typescript-eslint/camelcase */
  }

  async callMethod(method: string, params: any[] = []) {
    if (!this.rpcMethods[method]) throw new Error(`Invalid method: "${method}"`)
    return this.rpcMethods[method](...params)
  }

  async blockNumber(): Promise<number> {
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

  async getBlockByNumber(_blockNumber: number | string, fullTx = false) {
    let blockNumber = +_blockNumber
    if (_blockNumber === 'latest') {
      blockNumber = await this.blockNumber()
    }
    if (Number.isNaN(blockNumber)) {
      throw new Error('Supplied block number is not a number')
    }
    if (fullTx) {
      console.log('full tx')
    }
    const block = await this.context.node.layer2.getBlockByNumber(blockNumber)
    if (!block) throw new Error('Unable to find block')
    return block
  }
}
