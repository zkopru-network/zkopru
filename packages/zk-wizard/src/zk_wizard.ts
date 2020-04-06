/* eslint-disable @typescript-eslint/camelcase */
import { nanoSQL } from '@nano-sql/core'
import { Field, F, Point, EdDSA, signEdDSA } from '@zkopru/babyjubjub'
import { RawTx, ZkTx } from '@zkopru/transaction'
import { MerkleProof } from '@zkopru/tree'
import * as utils from '@zkopru/utils'
import { Grove } from '@zkopru/core'

export class ZkWizard {
  circuits: { [key: string]: Buffer }

  provingKeys: { [key: string]: {} }

  grove: Grove

  privKey: string

  pubKey: Point

  db: nanoSQL

  constructor({
    db,
    grove,
    privKey,
  }: {
    db: nanoSQL
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

      async function addMerkleProof({
        index,
        proof,
        buildZkTx,
      }: {
        index: number
        proof: MerkleProof
        buildZkTx: ({
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
        }) => Promise<ZkTx>
      }) {
        merkleProof[index] = proof
        if (isDataPrepared()) {
          const zkTx = await buildZkTx({
            tx,
            toMemo,
            data: { merkleProof, eddsa },
          })
          resolve(zkTx)
        }
      }

      const { buildZkTx } = this

      tx.inflow.forEach(async (utxo, index) => {
        eddsa[index] = signEdDSA({
          msg: utxo.hash(),
          privKey: this.privKey,
        })
        this.grove
          .utxoMerkleProof(utxo.hash())
          .then(proof => addMerkleProof({ index, proof, buildZkTx }))
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
    const input: { [name: string]: Field } = {}
    // inflow data
    tx.inflow.forEach((utxo, i) => {
      // private signals
      input[`spending_note[0][${i}]`] = utxo.eth
      input[`spending_note[1][${i}]`] = utxo.pubKey.x
      input[`spending_note[2][${i}]`] = utxo.pubKey.y
      input[`spending_note[3][${i}]`] = utxo.salt
      input[`spending_note[4][${i}]`] = utxo.tokenAddr
      input[`spending_note[5][${i}]`] = utxo.erc20Amount
      input[`spending_note[6][${i}]`] = utxo.nft
      input[`signatures[0][${i}]`] = data.eddsa[i].R8.x
      input[`signatures[1][${i}]`] = data.eddsa[i].R8.y
      input[`signatures[2][${i}]`] = data.eddsa[i].S
      input[`note_index[${i}]`] = data.merkleProof[i].index
      for (let j = 0; j < this.grove.config.utxoTreeDepth; j += 1) {
        input[`siblings[${j}][${i}]`] = data.merkleProof[i].siblings[j]
      }
      // public signals
      input[`inclusion_references[${i}]`] = data.merkleProof[i].root
      input[`nullifiers[${i}]`] = utxo.nullifier()
    })
    // outflow data
    tx.outflow.forEach((utxo, i) => {
      // private signals
      input[`new_note[0][${i}]`] = utxo.eth
      input[`new_note[1][${i}]`] = utxo.pubKey.x
      input[`new_note[2][${i}]`] = utxo.pubKey.y
      input[`new_note[3][${i}]`] = utxo.salt
      input[`new_note[4][${i}]`] = utxo.tokenAddr
      input[`new_note[5][${i}]`] = utxo.erc20Amount
      input[`new_note[6][${i}]`] = utxo.nft
      // public signals
      input[`new_note_hash[${i}]`] = utxo.hash()
      input[`typeof_new_note[${i}]`] = utxo.outflowType()
      input[`public_data[0][${i}]`] = utxo.publicData
        ? utxo.publicData.to
        : Field.zero
      input[`public_data[1][${i}]`] = utxo.publicData ? utxo.eth : Field.zero
      input[`public_data[2][${i}]`] = utxo.publicData
        ? utxo.tokenAddr
        : Field.zero
      input[`public_data[3][${i}]`] = utxo.publicData
        ? utxo.erc20Amount
        : Field.zero
      input[`public_data[4][${i}]`] = utxo.publicData ? utxo.nft : Field.zero
      input[`public_data[5][${i}]`] = utxo.publicData
        ? utxo.publicData.fee
        : Field.zero
    })
    input.swap = tx.swap ? tx.swap : Field.zero
    input.fee = tx.fee
    const stringifiedInputs: { [name: string]: string } = {}
    Object.keys(input).forEach(key => {
      stringifiedInputs[key] = input[key].toString()
    })
    const witness = await utils.calculateWitness(circuitWasm, stringifiedInputs)

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
