/* eslint-disable @typescript-eslint/camelcase */
import { InanoSQLInstance } from '@nano-sql/core'
import { Field, F, Point, EdDSA, signEdDSA } from '@zkopru/babyjubjub'
import {
  RawTx,
  ZkTx,
  OutflowType,
  Withdrawal,
  Migration,
} from '@zkopru/transaction'
import { MerkleProof, Grove } from '@zkopru/tree'
import * as utils from '@zkopru/utils'

export class ZkWizard {
  circuits: { [key: string]: Buffer }

  provingKeys: { [key: string]: {} }

  grove: Grove

  privKey: string

  pubKey: Point

  db: InanoSQLInstance

  constructor({
    db,
    grove,
    privKey,
  }: {
    db: InanoSQLInstance
    grove: Grove
    privKey: string
  }) {
    this.grove = grove
    this.privKey = privKey
    this.circuits = {}
    this.provingKeys = {}
    this.pubKey = Point.fromPrivKey(privKey)
    this.db = db
  }

  addCircuit({
    nInput,
    nOutput,
    wasm,
    provingKey,
  }: {
    nInput: number
    nOutput: number
    wasm: Buffer
    provingKey: {}
  }) {
    this.circuits[ZkWizard.circuitKey({ nInput, nOutput })] = wasm
    this.provingKeys[ZkWizard.circuitKey({ nInput, nOutput })] = provingKey
  }

  private static circuitKey({
    nInput,
    nOutput,
  }: {
    nInput: number
    nOutput: number
  }): string {
    return `${nInput}-${nOutput}`
  }

  /**
   * @param toMemo n-th outflow will be encrypted
   */
  async shield({ tx, toMemo }: { tx: RawTx; toMemo?: number }): Promise<ZkTx> {
    return new Promise<ZkTx>((resolve, reject) => {
      const merkleProof: { [hash: string]: MerkleProof } = {}
      const eddsa: { [hash: string]: EdDSA } = {}

      function isDataPrepared(): boolean {
        return (
          Object.keys(merkleProof).length === tx.inflow.length &&
          Object.keys(eddsa).length === tx.inflow.length
        )
      }

      tx.inflow.forEach(async (utxo, index) => {
        eddsa[index] = signEdDSA({
          msg: utxo.hash(),
          privKey: this.privKey,
        })
        this.grove
          .utxoMerkleProof(utxo.hash())
          .then(async proof => {
            merkleProof[index] = proof
            if (isDataPrepared()) {
              const zkTx = await this.buildZkTx({
                tx,
                toMemo,
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
    toMemo,
    data,
  }: {
    tx: RawTx
    toMemo?: number
    data: {
      merkleProof: { [hash: string]: MerkleProof }
      eddsa: { [hash: string]: EdDSA }
    }
  }): Promise<ZkTx> {
    const circuitWasm = this.circuits[
      ZkWizard.circuitKey({
        nInput: tx.inflow.length,
        nOutput: tx.outflow.length,
      })
    ]
    const provingKey = this.provingKeys[
      ZkWizard.circuitKey({
        nInput: tx.inflow.length,
        nOutput: tx.outflow.length,
      })
    ]
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
    const spendingNotes: string[][] = Array(7)
      .fill(undefined)
      .map(() => [])
    const signatures: string[][] = Array(3)
      .fill(undefined)
      .map(() => [])
    const noteIndexes: string[] = []
    const siblings: string[][] = Array(depth)
      .fill(undefined)
      .map(() => [])
    const inclusionRefes: string[] = []
    const nullifiers: string[] = []
    for (let i = 0; i < tx.inflow.length; i += 1) {
      const utxo = tx.inflow[i]
      // private signals
      spendingNotes[0][i] = utxo.eth.toString()
      spendingNotes[1][i] = utxo.pubKey.x.toString()
      spendingNotes[2][i] = utxo.pubKey.y.toString()
      spendingNotes[3][i] = utxo.salt.toString()
      spendingNotes[4][i] = utxo.tokenAddr.toString()
      spendingNotes[5][i] = utxo.erc20Amount.toString()
      spendingNotes[6][i] = utxo.nft.toString()
      signatures[0][i] = data.eddsa[i].R8.x.toString()
      signatures[1][i] = data.eddsa[i].R8.y.toString()
      signatures[2][i] = data.eddsa[i].S.toString()
      noteIndexes[i] = data.merkleProof[i].index.toString()
      data.merkleProof[i].siblings.forEach((sib, j) => {
        siblings[j][i] = sib.toString()
      })
      // public signals
      inclusionRefes[i] = data.merkleProof[i].root.toString()
      nullifiers[i] = utxo.nullifier().toString()
    }
    // outflow data
    const newNotes: string[][] = Array(7)
      .fill(undefined)
      .map(() => [])
    const newNoteHashes: string[] = []
    const typeOfNewNotes: string[] = []
    const publicData: string[][] = Array(6)
      .fill(undefined)
      .map(() => [])
    tx.outflow.forEach((note, i) => {
      // private signals
      newNotes[0][i] = note.eth.toString()
      newNotes[1][i] = note.pubKey.x.toString()
      newNotes[2][i] = note.pubKey.y.toString()
      newNotes[3][i] = note.salt.toString()
      newNotes[4][i] = note.tokenAddr.toString()
      newNotes[5][i] = note.erc20Amount.toString()
      newNotes[6][i] = note.nft.toString()
      // public slignals
      newNoteHashes[i] = note.hash().toString()
      typeOfNewNotes[i] = Field.from(
        note.outflowType || OutflowType.UTXO,
      ).toString()
      publicData[0][i] =
        note instanceof Withdrawal || note instanceof Migration
          ? note.publicData.to.toString()
          : Field.zero.toString()
      publicData[1][i] =
        note instanceof Withdrawal || note instanceof Migration
          ? note.eth.toString()
          : Field.zero.toString()
      publicData[2][i] =
        note instanceof Withdrawal || note instanceof Migration
          ? note.tokenAddr.toString()
          : Field.zero.toString()
      publicData[3][i] =
        note instanceof Withdrawal || note instanceof Migration
          ? note.erc20Amount.toString()
          : Field.zero.toString()
      publicData[4][i] =
        note instanceof Withdrawal || note instanceof Migration
          ? note.nft.toString()
          : Field.zero.toString()
      publicData[5][i] =
        note instanceof Withdrawal || note instanceof Migration
          ? note.publicData.fee.toString()
          : Field.zero.toString()
    })
    // private signals
    input.spending_note = spendingNotes
    input.signatures = signatures
    input.note_index = noteIndexes
    input.siblings = siblings
    input.new_note = newNotes
    // public signals
    input.fee = tx.fee.toString()
    input.swap = (tx.swap ? tx.swap : Field.zero).toString()
    input.inclusion_references = inclusionRefes
    input.nullifiers = nullifiers
    input.new_note_hash = newNoteHashes
    input.typeof_new_note = typeOfNewNotes
    input.public_data = publicData
    // for testing: fs.writeFileSync('./input.json', JSON.stringify(input))
    const witness = await utils.calculateWitness(circuitWasm, input)

    const { proof } = await utils.genProof(provingKey, witness)
    // let { proof, publicSignals } = Utils.genProof(snarkjs.unstringifyBigInts(provingKey), witness);
    // TODO handle genProof exception
    const zkTx: ZkTx = new ZkTx({
      inflow: tx.inflow.map((utxo, index) => {
        return {
          nullifier: utxo.nullifier(),
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
      memo: toMemo ? tx.outflow[toMemo].encrypt() : undefined,
    })
    return zkTx
  }
}
