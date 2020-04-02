import { Field, UTXO } from '@zkopru/commons'
import { LightRollUpTree, MerkleProof } from './tree'
import { Store } from './store'
import { poseidonHasher, keccakHasher } from './hasher'

export class Grove {
  utxoTrees: LightRollUpTree[]

  withdrawalTrees: LightRollUpTree[]

  nullifierTree!: LightRollUpTree

  depth: number

  prefix: string

  store: Store

  private prefixed = (key: string) => Buffer.from(`${this.prefix}:${key}`)

  private keys = {
    numOfUtxoTrees: this.prefixed('u-num'),
    numOfWithdrawalTrees: this.prefixed('w-num'),
    utxoTree: (groveIndex: number) =>
      this.prefixed(`u-${groveIndex}`).toString(),
    withdrawalTree: (groveIndex: number) =>
      this.prefixed(`w-${groveIndex}`).toString(),
    nullifierTree: this.prefixed('nullifier').toString(),
  }

  private bytes2Num = (buff: Buffer) => parseInt(buff.toString('hex'), 16)

  constructor(prefix: string, store: Store, depth: number) {
    this.prefix = prefix
    this.utxoTrees = []
    this.withdrawalTrees = []
    this.store = store
    this.depth = depth
  }

  async init() {
    // Retrieve UTXO trees
    let numOfUTXOTrees = 0
    try {
      numOfUTXOTrees = this.bytes2Num(
        await this.store.get(this.keys.numOfUtxoTrees),
      )
    } catch {
      numOfUTXOTrees = 0
    } finally {
      for (let i = 0; i < numOfUTXOTrees; i += 1) {
        this.utxoTrees[i] = Grove.utxoTree(
          this.keys.utxoTree(i),
          this.depth,
          this.store,
        )
      }
    }
    // Retrieve Withdrawal trees
    let numOfWithdrawalTrees = 0
    try {
      numOfWithdrawalTrees = this.bytes2Num(
        await this.store.get(this.keys.numOfWithdrawalTrees),
      )
    } catch {
      numOfWithdrawalTrees = 0
    } finally {
      for (let i = 0; i < numOfWithdrawalTrees; i += 1) {
        this.withdrawalTrees[i] = Grove.withdrawalTree(
          this.keys.withdrawalTree(i),
          this.depth,
          this.store,
        )
      }
    }
    // Retrieve the nullifier tree
    this.nullifierTree = Grove.nullifierTree(
      this.keys.nullifierTree,
      this.store,
    )
  }

  latestUTXOTree(): LightRollUpTree {
    return this.utxoTrees[this.utxoTrees.length - 1]
  }

  latestWithdrawalTree(): LightRollUpTree {
    return this.withdrawalTrees[this.withdrawalTrees.length - 1]
  }

  async appendUTXO(utxoHash: Field, utxo?: UTXO): Promise<void> {
    const tree = this.latestUTXOTree()
    if (tree && (await tree.index()).lt(await tree.maxSize())) {
      await tree.append({ leafHash: utxoHash, utxo })
    } else {
      const newTreeIndex = this.utxoTrees.length
      const newTree = Grove.utxoTree(
        this.keys.utxoTree(newTreeIndex),
        this.depth,
        this.store,
      )
      this.utxoTrees.push(newTree)
      await this.recordTrees()
      await newTree.append({ leafHash: utxoHash })
    }
  }

  async appendWithdrawal(withdrawal: Field): Promise<void> {
    const tree = this.latestWithdrawalTree()
    if (tree && (await tree.index()).lt(await tree.maxSize())) {
      await tree.append({ leafHash: withdrawal })
    } else {
      const newTreeIndex = this.withdrawalTrees.length
      const newTree = Grove.withdrawalTree(
        this.keys.withdrawalTree(newTreeIndex),
        this.depth,
        this.store,
      )
      this.withdrawalTrees.push(newTree)
      await this.recordTrees()
      await newTree.append({ leafHash: withdrawal })
    }
  }

  async utxoMerkleProof(utxo: Field): Promise<MerkleProof> {
    let tree: LightRollUpTree
    let proof
    for (let i = this.utxoTrees.length - 1; i >= 0; i -= 1) {
      tree = this.utxoTrees[i]
      proof = await tree.merkleProof(utxo)
      if (proof) break
    }
    if (!proof) throw Error('Failed to find utxo')
    return proof
  }

  async withdrawalMerkleProof(withdrawal: Field): Promise<MerkleProof> {
    let tree: LightRollUpTree
    let proof
    for (let i = this.withdrawalTrees.length - 1; i >= 0; i -= 1) {
      tree = this.withdrawalTrees[i]
      proof = await tree.merkleProof(withdrawal)
      if (proof) break
    }
    if (!proof) throw Error('Failed to find utxo')
    return proof
  }

  private async recordTrees() {
    await this.store.batchPut([
      {
        key: this.keys.numOfUtxoTrees,
        value: Field.from(this.utxoTrees.length).toBuffer(),
      },
      {
        key: this.keys.numOfWithdrawalTrees,
        value: Field.from(this.withdrawalTrees.length).toBuffer(),
      },
    ])
  }

  static utxoTree(
    prefix: string,
    depth: number,
    store: Store,
  ): LightRollUpTree {
    const hasher = poseidonHasher(depth)
    return new LightRollUpTree({ prefix, store, hasher, lightSync: true })
  }

  static withdrawalTree(
    prefix: string,
    depth: number,
    store: Store,
  ): LightRollUpTree {
    const hasher = keccakHasher(depth)
    return new LightRollUpTree({ prefix, store, hasher, lightSync: true })
  }

  static nullifierTree(prefix: string, store: Store): LightRollUpTree {
    const depth = 255
    const hasher = keccakHasher(depth)
    return new LightRollUpTree({ prefix, store, hasher, lightSync: true })
  }
}
