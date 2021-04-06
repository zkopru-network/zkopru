/* eslint-disable @typescript-eslint/camelcase */
import { ZkAccount } from '@zkopru/account'
import { Fp, F } from '@zkopru/babyjubjub'
import {
  RawTx,
  ZkTx,
  OutflowType,
  Withdrawal,
  Migration,
  Utxo,
  ZkAddress,
} from '@zkopru/transaction'
import { MerkleProof, UtxoTree } from '@zkopru/tree'
import { logger } from '@zkopru/utils'
import path from 'path'
import os from 'os'
import fs from 'fs'
import fetch from 'node-fetch'
import { SNARKResult, genSNARK } from './snark'

const IPFS_GATEWAY_HOST = `https://ipfs.tubby.cloud`

export class ZkWizard {
  path?: string

  cid?: string

  tmpdirPath?: string

  utxoTree: UtxoTree

  // genProof!: (witness: ArrayBuffer, provingKey: ArrayBuffer) => Promise<any>

  constructor({
    utxoTree,
    path: localPath,
    cid,
  }: {
    utxoTree: UtxoTree
    path?: string
    cid?: string
  }) {
    this.utxoTree = utxoTree
    if (!localPath && !cid) {
      throw new Error('Either a snark key path or cid must be specified')
    }
    this.path = localPath
    if (cid && cid.indexOf('/ipfs/') !== 0 && cid.indexOf('/ipns/') !== 0) {
      throw new Error('CID should begin with /ipfs/ or /ipns/')
    }
    this.cid = cid
  }

  get tmpdir() {
    if (this.tmpdirPath) return this.tmpdirPath
    this.tmpdirPath = os.tmpdir()
    return this.tmpdirPath
  }

  /**
   * @param toMemo n-th outflow will be encrypted
   */
  async shield({
    tx,
    from,
    encryptTo,
  }: {
    tx: RawTx
    from: ZkAccount
    encryptTo?: ZkAddress
  }): Promise<ZkTx> {
    return new Promise<ZkTx>((resolve, reject) => {
      const merkleProof: { [hash: number]: MerkleProof<Fp> } = {}

      function isDataPrepared(): boolean {
        return Object.keys(merkleProof).length === tx.inflow.length
      }

      tx.inflow.forEach(async (utxo, index) => {
        this.utxoTree
          .merkleProof({ hash: utxo.hash() })
          .then(async proof => {
            merkleProof[index] = proof
            if (isDataPrepared()) {
              const zkTx = await this.buildZkTx({
                tx,
                encryptTo,
                signer: from,
                merkleProof,
              })
              resolve(zkTx)
            }
          })
          .catch(reject)
      })
    })
  }

  private async loadKeyPaths(
    nIn: number,
    nOut: number,
  ): Promise<{
    wasmPath: string
    zkeyPath: string
    vKey: Record<string, any>
  }> {
    logger.info(`${this.path}`)
    if (this.path) {
      const vKeyPath = path.join(
        this.path,
        'vks',
        `zk_transaction_${nIn}_${nOut}.vk.json`,
      )
      const vKey = JSON.parse(fs.readFileSync(vKeyPath).toString())
      return {
        wasmPath: path.join(
          this.path,
          'circuits',
          `zk_transaction_${nIn}_${nOut}.wasm`,
        ),
        zkeyPath: path.join(
          this.path,
          'zkeys',
          `zk_transaction_${nIn}_${nOut}.zkey`,
        ),
        vKey,
      }
    }
    // TODO: hash verification
    logger.info(this.tmpdir)
    if (this.cid) {
      const wasmUrlPath = path.join(
        this.cid,
        'circuits',
        `zk_transaction_${nIn}_${nOut}.wasm`,
      )
      const zKeyUrlPath = path.join(
        this.cid,
        'zkeys',
        `zk_transaction_${nIn}_${nOut}.zkey`,
      )
      const vKeyUrlPath = path.join(
        this.cid,
        'vks',
        `zk_transaction_${nIn}_${nOut}.vk.json`,
      )
      const wasmPath = path.join(
        this.tmpdir,
        `zk_transaction_${nIn}_${nOut}.wasm`,
      )
      const zkeyPath = path.join(
        this.tmpdir,
        `zk_transaction_${nIn}_${nOut}.zkey`,
      )
      let vKey: Record<string, any>
      {
        logger.info('Downloading vkey')
        const response = await fetch(
          new URL(vKeyUrlPath, IPFS_GATEWAY_HOST).toString(),
        )
        vKey = await response.json()
      }
      if (!fs.existsSync(wasmPath)) {
        logger.info('Downloading wasm')
        const response = await fetch(
          new URL(wasmUrlPath, IPFS_GATEWAY_HOST).toString(),
        )
        const filestream = fs.createWriteStream(wasmPath)
        await new Promise((rs, rj) => {
          response.body.pipe(filestream)
          response.body.on('error', rj)
          filestream.on('finish', rs)
        })
      }
      if (!fs.existsSync(zkeyPath)) {
        logger.info('Downloading zkey')
        const response = await fetch(
          new URL(zKeyUrlPath, IPFS_GATEWAY_HOST).toString(),
        )
        const filestream = fs.createWriteStream(zkeyPath)
        await new Promise((rs, rj) => {
          response.body.pipe(filestream)
          response.body.on('error', rj)
          filestream.on('finish', rs)
        })
      }
      return {
        wasmPath,
        zkeyPath,
        vKey,
      }
    }
    throw new Error('No cid or path for keys!')
  }

  private async buildZkTx({
    tx,
    encryptTo,
    signer,
    merkleProof,
  }: {
    tx: RawTx
    encryptTo?: ZkAddress
    signer: ZkAccount
    merkleProof: { [hash: number]: MerkleProof<Fp> }
  }): Promise<ZkTx> {
    const nIn = tx.inflow.length
    const nOut = tx.outflow.length
    const { wasmPath, zkeyPath, vKey } = await this.loadKeyPaths(nIn, nOut)
    let fileNotExistMsg: string | undefined
    if (!fs.existsSync(wasmPath)) {
      fileNotExistMsg = `Does not have the wasm code for the ${tx.inflow.length} inputs and ${tx.outflow.length} outputs circuit`
    } else if (!fs.existsSync(zkeyPath)) {
      fileNotExistMsg = `Does not have the zkey for the ${tx.inflow.length} inputs and ${tx.outflow.length} outputs circuit`
    }
    if (fileNotExistMsg) throw new Error(fileNotExistMsg)
    const inputs = ZkWizard.snarkInput({
      tx,
      signer,
      merkleProof,
    })

    const start = Date.now()
    const result: SNARKResult = await genSNARK(inputs, wasmPath, zkeyPath, vKey)
    const end = Date.now()
    logger.debug(
      `Shielded (${tx.inflow.length} => ${tx.outflow.length}): proof: ${end -
        start}`,
    )
    // TODO handle genProof exception
    let memo: Buffer | undefined
    if (encryptTo !== undefined) {
      const noteToEncrypt = tx.outflow.find(outflow =>
        outflow.owner.eq(encryptTo),
      )
      if (noteToEncrypt instanceof Utxo) memo = noteToEncrypt.encrypt()
    }
    const zkTx: ZkTx = new ZkTx({
      inflow: tx.inflow.map((utxo, index) => {
        return {
          nullifier: utxo.nullifier(
            signer.getNullifierSeed(),
            merkleProof[index].index,
          ),
          root: merkleProof[index].root,
        }
      }),
      outflow: tx.outflow.map(utxo => utxo.toZkOutflow()),
      fee: tx.fee,
      proof: {
        pi_a: result.proof.pi_a.map(Fp.from),
        pi_b: result.proof.pi_b.map(
          (arr: F[]) => arr.map((val: F) => Fp.from(val)), // caution: snarkjs G2Point is reversed.
        ),
        pi_c: result.proof.pi_c.map(Fp.from),
      },
      swap: tx.swap,
      memo,
    })
    return zkTx
  }

  static snarkInput({
    tx,
    merkleProof,
    signer,
  }: {
    tx: RawTx
    merkleProof: { [hash: number]: MerkleProof<Fp> }
    signer: ZkAccount
  }): {
    [name: string]: bigint | bigint[] | bigint[][]
  } {
    const inputs: { [name: string]: bigint | bigint[] | bigint[][] } = {}
    const depth = merkleProof[0].siblings.length
    const spendingNoteEdDSAPoint: bigint[][] = Array(2)
      .fill(undefined)
      .map(() => [])
    const spendingNoteEdDSA: bigint[][] = Array(3)
      .fill(undefined)
      .map(() => [])
    const spendingNoteNullifierSeed: bigint[] = []
    const spendingNoteSalt: bigint[] = []
    const spendingNoteEth: bigint[] = []
    const spendingNoteTokenAddr: bigint[] = []
    const spendingNoteErc20: bigint[] = []
    const spendingNoteErc721: bigint[] = []
    const noteIndexes: bigint[] = []
    const siblings: bigint[][] = Array(depth)
      .fill(undefined)
      .map(() => [])
    const inclusionRefes: bigint[] = []
    const nullifiers: bigint[] = []

    for (let i = 0; i < tx.inflow.length; i += 1) {
      const utxo = tx.inflow[i]
      // private signals
      const eddsa = signer.signEdDSA(utxo.hash())
      spendingNoteEdDSAPoint[0][i] = signer.getEdDSAPubKey().x.toBigInt()
      spendingNoteEdDSAPoint[1][i] = signer.getEdDSAPubKey().y.toBigInt()
      spendingNoteEdDSA[0][i] = eddsa.R8.x.toBigInt()
      spendingNoteEdDSA[1][i] = eddsa.R8.y.toBigInt()
      spendingNoteEdDSA[2][i] = eddsa.S.toBigInt()
      spendingNoteNullifierSeed[i] = signer.getNullifierSeed().toBigInt()
      spendingNoteSalt[i] = utxo.salt.toBigInt()
      spendingNoteEth[i] = utxo.eth().toBigInt()
      spendingNoteTokenAddr[i] = utxo.tokenAddr().toBigInt()
      spendingNoteErc20[i] = utxo.erc20Amount().toBigInt()
      spendingNoteErc721[i] = utxo.nft().toBigInt()
      noteIndexes[i] = merkleProof[i].index.toBigInt()
      merkleProof[i].siblings.forEach((sib, j) => {
        siblings[j][i] = sib.toBigInt()
      })
      // public signals
      inclusionRefes[i] = merkleProof[i].root.toBigInt()
      nullifiers[i] = utxo
        .nullifier(signer.getNullifierSeed(), merkleProof[i].index)
        .toBigInt()
    }
    // outflow data
    const newNoteSpendingPubkey: bigint[] = []
    const newNoteSalt: bigint[] = []
    const newNoteEth: bigint[] = []
    const newNoteTokenAddr: bigint[] = []
    const newNoteErc20: bigint[] = []
    const newNoteErc721: bigint[] = []
    const newNoteHashes: bigint[] = []
    const typeOfNewNotes: bigint[] = []
    const publicDataTo: bigint[] = []
    const publicDataEth: bigint[] = []
    const publicDataTokenAddr: bigint[] = []
    const publicDataErc20: bigint[] = []
    const publicDataErc721: bigint[] = []
    const publicDataFee: bigint[] = []

    tx.outflow.forEach((note, i) => {
      // private signals
      newNoteSpendingPubkey[i] = note.owner.spendingPubKey().toBigInt()
      newNoteSalt[i] = note.salt.toBigInt()
      newNoteEth[i] = note.eth().toBigInt()
      newNoteTokenAddr[i] = note.tokenAddr().toBigInt()
      newNoteErc20[i] = note.erc20Amount().toBigInt()
      newNoteErc721[i] = note.nft().toBigInt()
      // public slignals
      newNoteHashes[i] = note.hash().toBigInt()
      typeOfNewNotes[i] = Fp.from(
        note.outflowType || OutflowType.UTXO,
      ).toBigInt()
      publicDataTo[i] =
        note instanceof Withdrawal || note instanceof Migration
          ? note.publicData.to.toBigInt()
          : Fp.zero.toBigInt()
      publicDataEth[i] =
        note instanceof Withdrawal || note instanceof Migration
          ? note.eth().toBigInt()
          : Fp.zero.toBigInt()
      publicDataTokenAddr[i] =
        note instanceof Withdrawal || note instanceof Migration
          ? note.tokenAddr().toBigInt()
          : Fp.zero.toBigInt()
      publicDataErc20[i] =
        note instanceof Withdrawal || note instanceof Migration
          ? note.erc20Amount().toBigInt()
          : Fp.zero.toBigInt()
      publicDataErc721[i] =
        note instanceof Withdrawal || note instanceof Migration
          ? note.nft().toBigInt()
          : Fp.zero.toBigInt()
      publicDataFee[i] =
        note instanceof Withdrawal || note instanceof Migration
          ? note.publicData.fee.toBigInt()
          : Fp.zero.toBigInt()
    })
    // spending note private signals
    inputs.spending_note_eddsa_point = spendingNoteEdDSAPoint
    inputs.spending_note_eddsa_sig = spendingNoteEdDSA
    inputs.spending_note_nullifier_seed = spendingNoteNullifierSeed
    inputs.spending_note_salt = spendingNoteSalt
    inputs.spending_note_eth = spendingNoteEth
    inputs.spending_note_token_addr = spendingNoteTokenAddr
    inputs.spending_note_erc20 = spendingNoteErc20
    inputs.spending_note_erc721 = spendingNoteErc721
    inputs.note_index = noteIndexes
    inputs.siblings = siblings
    // spending note public signals
    inputs.inclusion_references = inclusionRefes
    inputs.nullifiers = nullifiers
    // new utxos private signals
    inputs.new_note_spending_pubkey = newNoteSpendingPubkey
    inputs.new_note_salt = newNoteSalt
    inputs.new_note_eth = newNoteEth
    inputs.new_note_token_addr = newNoteTokenAddr
    inputs.new_note_erc20 = newNoteErc20
    inputs.new_note_erc721 = newNoteErc721
    // new utxos public signals
    inputs.new_note_hash = newNoteHashes
    inputs.typeof_new_note = typeOfNewNotes
    // public data for migration or withdrawal leaves
    inputs.public_data_to = publicDataTo
    inputs.public_data_eth = publicDataEth
    inputs.public_data_token_addr = publicDataTokenAddr
    inputs.public_data_erc20 = publicDataErc20
    inputs.public_data_erc721 = publicDataErc721
    inputs.public_data_fee = publicDataFee

    // tx metadata - public signals
    inputs.fee = tx.fee.toBigInt()
    inputs.swap = (tx.swap ? tx.swap : Fp.zero).toBigInt()
    return inputs
  }
}
