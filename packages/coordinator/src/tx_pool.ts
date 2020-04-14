import { Hex } from 'web3-utils'
import { ZkTx } from '@zkopru/transaction'
import { root } from '@zkopru/utils'
import * as snarkjs from 'snarkjs'

const PENDING = 'pending'

export interface TxPoolInterface {
  addVerifier({
    nInput,
    nOutput,
    vk,
  }: {
    nInput: number
    nOutput: number
    vk: object
  }): Promise<void>
  pendingNum(): Promise<number>
  addToTxPool(zkTx: ZkTx): Promise<void>
  pickPendingTxs(maxBytes: number): Promise<ZkTx[]>
  updateTxsAsIncludedInBlock({
    txRoot,
    blockHash,
  }: {
    txRoot: string
    blockHash: string
  }): Promise<void>
  verifyTx(zkTx: ZkTx): Promise<boolean>
  revertTxs(txRoot: string): Promise<void>
}

export class TxMemPool implements TxPoolInterface {
  blockTxMap: {
    [includedIn: string]: Hex[]
  }

  txs: {
    [proposalHash: string]: ZkTx
  }

  verifyingKeys: { [key: string]: {} }

  constructor() {
    this.blockTxMap = {
      [PENDING]: [],
    }
    this.txs = {}
    this.verifyingKeys = {}
  }

  async addVerifier({
    nInput,
    nOutput,
    vk,
  }: {
    nInput: number
    nOutput: number
    vk: object
  }): Promise<void> {
    const key = `${nInput}-${nOutput}`
    this.verifyingKeys[key] = snarkjs.unstringifyBigInts(vk)
  }

  async pendingNum(): Promise<number> {
    return this.blockTxMap[PENDING].length
  }

  async addToTxPool(zkTx: ZkTx): Promise<void> {
    const proposalHash = zkTx.hash()
    if (!this.verifyTx(zkTx)) {
      throw Error('SNARK is invalid')
    }
    this.addToBlock({ blockHash: PENDING, proposalHash })
    this.txs[proposalHash] = zkTx
  }

  async pickPendingTxs(maxBytes: number): Promise<ZkTx[]> {
    // TODO add atomic swap tx logic here
    let available = maxBytes
    this.sortPendingTxs()
    const candidates = this.blockTxMap[PENDING]
    const picked: ZkTx[] = []
    while (available > 0 && candidates.length > 0) {
      const candidate = candidates.pop()
      const tx = this.txs[candidate?.toString() || '']
      const size = tx.size()
      if (available >= size) {
        available -= size
        picked.push(tx)
      }
    }
    const proposalHashes = picked.map(tx => tx.hash())
    const txRoot = root(proposalHashes)
    this.blockTxMap[txRoot] = proposalHashes
    return picked
  }

  async updateTxsAsIncludedInBlock({
    txRoot,
    blockHash,
  }: {
    txRoot: string
    blockHash: string
  }): Promise<void> {
    this.blockTxMap[blockHash] = this.blockTxMap[txRoot]
    delete this.blockTxMap[txRoot]
  }

  async verifyTx(zkTx: ZkTx): Promise<boolean> {
    const key = `${zkTx.inflow.length}-${zkTx.outflow.length}`
    const isValid = snarkjs.groth.isValid(
      this.verifyingKeys[key],
      zkTx.circomProof(),
      zkTx.signals(),
    )
    return isValid
  }

  async revertTxs(txRoot: string): Promise<void> {
    this.blockTxMap[txRoot].forEach(hash => this.blockTxMap[PENDING].push(hash))
    this.sortPendingTxs()
  }

  private sortPendingTxs() {
    this.blockTxMap[PENDING].sort((a, b) =>
      this.txs[a].fee.gt(this.txs[b].fee) ? 1 : -1,
    )
  }

  private addToBlock({
    blockHash,
    proposalHash,
  }: {
    blockHash: string
    proposalHash: Hex
  }) {
    let proposalHashes: Hex[] = this.blockTxMap[blockHash]
    // let txs: ZkTransaction[] = this.txs[blockHash];
    if (!proposalHashes) {
      proposalHashes = []
      this.blockTxMap[blockHash] = proposalHashes
    }
    const alreadyExist = proposalHashes.reduce((exist, val) => {
      if (exist) return true

      return val === proposalHash
    }, false)
    if (!alreadyExist) {
      proposalHashes.push(proposalHash)
    } else {
      throw Error('Already exists')
    }
  }

  // async blockReverted(blockHash: string) {
  //   try {
  //     // this.db.create
  //   } finally {
  //   }
  // }
}
