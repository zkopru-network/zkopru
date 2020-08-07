/* eslint-disable @typescript-eslint/camelcase */
import { ZkAccount } from '@zkopru/account'
import { Field, F, EdDSA, Point } from '@zkopru/babyjubjub'
import {
  RawTx,
  ZkTx,
  OutflowType,
  Withdrawal,
  Migration,
  Utxo,
  ZkAddress,
} from '@zkopru/transaction'
import { MerkleProof, Grove } from '@zkopru/tree'
import path from 'path'
import * as ffjs from 'ffjavascript'
import * as circomruntime from 'circom_runtime'
import * as wasmsnark from 'wasmsnark'
import { logger, toArrayBuffer } from '@zkopru/utils'
import fs from 'fs'
import { witnessToBinary } from './converter'

export class ZkWizard {
  path: string

  grove: Grove

  prover: any
  // genProof!: (witness: ArrayBuffer, provingKey: ArrayBuffer) => Promise<any>

  constructor({ grove, path }: { grove: Grove; path: string }) {
    this.grove = grove
    this.path = path
  }

  async init() {
    if (!this.prover) {
      this.prover = await wasmsnark.buildBn128()
    }
  }

  async terminate() {
    if (this.prover) {
      await this.prover.terminate()
    }
  }

  /**
   * @param toMemo n-th outflow will be encrypted
   */
  async shield({
    tx,
    account,
    encryptTo,
  }: {
    tx: RawTx
    account: ZkAccount
    encryptTo?: ZkAddress
  }): Promise<ZkTx> {
    return new Promise<ZkTx>((resolve, reject) => {
      const merkleProof: { [hash: number]: MerkleProof<Field> } = {}
      const eddsa: { [hash: number]: EdDSA } = {}

      function isDataPrepared(): boolean {
        return (
          Object.keys(merkleProof).length === tx.inflow.length &&
          Object.keys(eddsa).length === tx.inflow.length
        )
      }

      tx.inflow.forEach(async (utxo, index) => {
        eddsa[index] = account.signEdDSA(utxo.hash())
        this.grove
          .utxoMerkleProof(utxo.hash())
          .then(async proof => {
            merkleProof[index] = proof
            if (isDataPrepared()) {
              const zkTx = await this.buildZkTx({
                tx,
                encryptTo,
                eddsaPoint: account.getEdDSAPoint(),
                nullifierSeed: account.getNullifierSeed(),
                data: { merkleProof, eddsa },
              })
              resolve(zkTx)
            }
          })
          .catch(reject)
      })
    })
  }

  private async buildZkTx({
    tx,
    encryptTo,
    eddsaPoint,
    nullifierSeed,
    data,
  }: {
    tx: RawTx
    encryptTo?: ZkAddress
    eddsaPoint: Point
    nullifierSeed: Field
    data: {
      merkleProof: { [hash: number]: MerkleProof<Field> }
      eddsa: { [hash: number]: EdDSA }
    }
  }): Promise<ZkTx> {
    const nIn = tx.inflow.length
    const nOut = tx.outflow.length
    await this.init()
    const wasmPath = path.join(
      this.path,
      'circuits',
      `zk_transaction_${nIn}_${nOut}.wasm`,
    )
    const pkPath = path.join(
      this.path,
      'pks',
      `zk_transaction_${nIn}_${nOut}.pk.bin`,
    )
    const circuitWasm = await fs.promises.readFile(wasmPath)
    const provingKey = toArrayBuffer(await fs.promises.readFile(pkPath))
    if (circuitWasm === undefined || provingKey === undefined) {
      throw Error(
        `Does not support transactions for ${tx.inflow.length} inputs and ${tx.outflow.length} outputs`,
      )
      // reject(
      //   ,
      // )
    }
    const input: {
      [name: string]: string | string[] | string[][]
    } = {}
    // inflow data
    const depth = data.merkleProof[0].siblings.length
    const spendingNoteEdDSAPoint: string[][] = Array(2)
      .fill(undefined)
      .map(() => [])
    const spendingNoteEdDSA: string[][] = Array(3)
      .fill(undefined)
      .map(() => [])
    const spendingNoteNullifierSeed: string[] = []
    const spendingNoteSalt: string[] = []
    const spendingNoteEth: string[] = []
    const spendingNoteTokenAddr: string[] = []
    const spendingNoteErc20: string[] = []
    const spendingNoteErc721: string[] = []
    const noteIndexes: string[] = []
    const siblings: string[][] = Array(depth)
      .fill(undefined)
      .map(() => [])
    const inclusionRefes: string[] = []
    const nullifiers: string[] = []

    for (let i = 0; i < tx.inflow.length; i += 1) {
      const utxo = tx.inflow[i]
      // private signals
      spendingNoteEdDSAPoint[0][i] = eddsaPoint.x.toString()
      spendingNoteEdDSAPoint[1][i] = eddsaPoint.y.toString()
      spendingNoteEdDSA[0][i] = data.eddsa[i].R8.x.toString()
      spendingNoteEdDSA[1][i] = data.eddsa[i].R8.y.toString()
      spendingNoteEdDSA[2][i] = data.eddsa[i].S.toString()
      spendingNoteNullifierSeed[i] = nullifierSeed.toString()
      spendingNoteSalt[i] = utxo.salt.toString()
      spendingNoteEth[i] = utxo.eth().toString()
      spendingNoteTokenAddr[i] = utxo.tokenAddr().toString()
      spendingNoteErc20[i] = utxo.erc20Amount().toString()
      spendingNoteErc721[i] = utxo.nft().toString()
      noteIndexes[i] = data.merkleProof[i].index.toString()
      data.merkleProof[i].siblings.forEach((sib, j) => {
        siblings[j][i] = sib.toString()
      })
      // public signals
      inclusionRefes[i] = data.merkleProof[i].root.toString()
      nullifiers[i] = utxo
        .nullifier(nullifierSeed, data.merkleProof[i].index)
        .toString()
    }
    // outflow data
    const newNoteSpendingPubkey: string[] = []
    const newNoteSalt: string[] = []
    const newNoteEth: string[] = []
    const newNoteTokenAddr: string[] = []
    const newNoteErc20: string[] = []
    const newNoteErc721: string[] = []
    const newNoteHashes: string[] = []
    const typeOfNewNotes: string[] = []
    const publicDataTo: string[] = []
    const publicDataEth: string[] = []
    const publicDataTokenAddr: string[] = []
    const publicDataErc20: string[] = []
    const publicDataErc721: string[] = []
    const publicDataFee: string[] = []

    tx.outflow.forEach((note, i) => {
      // private signals
      newNoteSpendingPubkey[i] = note.owner.spendingPubKey().toString()
      newNoteSalt[i] = note.salt.toString()
      newNoteEth[i] = note.eth().toString()
      newNoteTokenAddr[i] = note.tokenAddr().toString()
      newNoteErc20[i] = note.erc20Amount().toString()
      newNoteErc721[i] = note.nft().toString()
      // public slignals
      newNoteHashes[i] = note.hash().toString()
      typeOfNewNotes[i] = Field.from(
        note.outflowType || OutflowType.UTXO,
      ).toString()
      publicDataTo[i] =
        note instanceof Withdrawal || note instanceof Migration
          ? note.publicData.to.toString()
          : Field.zero.toString()
      publicDataEth[i] =
        note instanceof Withdrawal || note instanceof Migration
          ? note.eth().toString()
          : Field.zero.toString()
      publicDataTokenAddr[i] =
        note instanceof Withdrawal || note instanceof Migration
          ? note.tokenAddr().toString()
          : Field.zero.toString()
      publicDataErc20[i] =
        note instanceof Withdrawal || note instanceof Migration
          ? note.erc20Amount().toString()
          : Field.zero.toString()
      publicDataErc721[i] =
        note instanceof Withdrawal || note instanceof Migration
          ? note.nft().toString()
          : Field.zero.toString()
      publicDataFee[i] =
        note instanceof Withdrawal || note instanceof Migration
          ? note.publicData.fee.toString()
          : Field.zero.toString()
    })
    // spending note private signals
    input.spending_note_eddsa_point = spendingNoteEdDSAPoint
    input.spending_note_eddsa_sig = spendingNoteEdDSA
    input.spending_note_nullifier_seed = spendingNoteNullifierSeed
    input.spending_note_salt = spendingNoteSalt
    input.spending_note_eth = spendingNoteEth
    input.spending_note_token_addr = spendingNoteTokenAddr
    input.spending_note_erc20 = spendingNoteErc20
    input.spending_note_erc721 = spendingNoteErc721
    input.note_index = noteIndexes
    input.siblings = siblings
    // spending note public signals
    input.inclusion_references = inclusionRefes
    input.nullifiers = nullifiers
    // new utxos private signals
    input.new_note_spending_pubkey = newNoteSpendingPubkey
    input.new_note_salt = newNoteSalt
    input.new_note_eth = newNoteEth
    input.new_note_token_addr = newNoteTokenAddr
    input.new_note_erc20 = newNoteErc20
    input.new_note_erc721 = newNoteErc721
    // new utxos public signals
    input.new_note_hash = newNoteHashes
    input.typeof_new_note = typeOfNewNotes
    // public data for migration or withdrawal leaves
    input.public_data_to = publicDataTo
    input.public_data_eth = publicDataEth
    input.public_data_token_addr = publicDataTokenAddr
    input.public_data_erc20 = publicDataErc20
    input.public_data_erc721 = publicDataErc721
    input.public_data_fee = publicDataFee

    // tx metadata - public signals
    input.fee = tx.fee.toString()
    input.swap = (tx.swap ? tx.swap : Field.zero).toString()

    const start = Date.now()
    // for testing: fs.writeFileSync('./input.json', JSON.stringify(input))
    const wc = await circomruntime.WitnessCalculatorBuilder(circuitWasm, {
      sanityCheck: true,
    })
    const witness = await wc.calculateWitness(
      ffjs.utils.unstringifyBigInts(input),
    )
    const wasmWitness = witnessToBinary(witness)
    const wasmPk = provingKey // == pkToBinary(jsonProvingKey)
    const intermediate = Date.now()
    const proof = await this.prover.groth16GenProof(wasmWitness, wasmPk)
    const end = Date.now()
    logger.debug(
      `Shielded (${tx.inflow.length} => ${
        tx.outflow.length
      }): witness - ${intermediate - start} / proof: ${end - intermediate}`,
    )
    // let { proof, publicSignals } = Utils.genProof(snarkjs.unstringifyBigInts(provingKey), witness);
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
            nullifierSeed,
            data.merkleProof[index].index,
          ),
          root: data.merkleProof[index].root,
        }
      }),
      outflow: tx.outflow.map(utxo => utxo.toZkOutflow()),
      fee: tx.fee,
      proof: {
        pi_a: proof.pi_a.map(Field.from),
        pi_b: proof.pi_b.map((arr: F[]) =>
          arr.map((val: F) => Field.from(val)),
        ),
        pi_c: proof.pi_c.map(Field.from),
      },
      swap: tx.swap,
      memo,
    })
    return zkTx
  }
}
