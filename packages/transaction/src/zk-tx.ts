/* eslint-disable @typescript-eslint/camelcase */
import { soliditySha3Raw } from 'web3-utils'
import { Field } from '@zkopru/babyjubjub'
import * as Utils from '@zkopru/utils'
import { Bytes32, Uint256 } from 'soltypes'
import { OutflowType } from './note'

export interface ZkInflow {
  nullifier: Field
  root: Field
}

export interface ZkOutflow {
  note: Field
  outflowType: Field
  data?: PublicData
}

export interface PublicData {
  to: Field
  eth: Field
  tokenAddr: Field
  erc20Amount: Field
  nft: Field
  fee: Field
}

export interface SNARK {
  pi_a: Field[]
  pi_b: Field[][]
  pi_c: Field[]
}

export class ZkTx {
  inflow: ZkInflow[]

  outflow: ZkOutflow[]

  fee: Field

  proof?: SNARK

  swap?: Field

  memo?: Buffer

  cache: {
    hash?: Bytes32
    size?: number
  }

  constructor({
    inflow,
    outflow,
    fee,
    proof,
    swap,
    memo,
  }: {
    inflow: ZkInflow[]
    outflow: ZkOutflow[]
    fee: Field
    proof?: SNARK
    swap?: Field
    memo?: Buffer
  }) {
    this.inflow = inflow
    this.outflow = outflow
    this.fee = fee
    this.proof = proof
    this.swap = swap
    this.memo = memo
    this.cache = {}
  }

  encode(): Buffer {
    if (!this.proof) throw Error('SNARK does not exist')
    return Buffer.concat([
      Uint8Array.from([this.inflow.length]),
      ...this.inflow.map(inflow =>
        Buffer.concat([
          inflow.root.toBuffer('be', 32),
          inflow.nullifier.toBuffer('be', 32),
        ]),
      ),
      Uint8Array.from([this.outflow.length]),
      ...this.outflow.map(outflow =>
        Buffer.concat([
          outflow.note.toBuffer('be', 32),
          outflow.outflowType.toBuffer('be', 1),
          outflow.data
            ? Buffer.concat([
                outflow.data.to.toBuffer('be', 20),
                outflow.data.eth.toBuffer('be', 32),
                outflow.data.tokenAddr.toBuffer('be', 20),
                outflow.data.erc20Amount.toBuffer('be', 32),
                outflow.data.nft.toBuffer('be', 32),
                outflow.data.fee.toBuffer('be', 32),
              ])
            : Buffer.from([]),
        ]),
      ),
      this.fee.toBuffer('be', 32),
      // caution: snarkjs G1Point is reversed
      this.proof.pi_a[0].toBuffer('be', 32),
      this.proof.pi_a[1].toBuffer('be', 32),
      this.proof.pi_b[0][1].toBuffer('be', 32),
      this.proof.pi_b[0][0].toBuffer('be', 32),
      this.proof.pi_b[1][1].toBuffer('be', 32),
      this.proof.pi_b[1][0].toBuffer('be', 32),
      this.proof.pi_c[0].toBuffer('be', 32),
      this.proof.pi_c[1].toBuffer('be', 32),
      Uint8Array.from([
        this.swap ? 1 + (this.memo ? 2 : 0) : 0 + (this.memo ? 2 : 0),
      ]), // b'11' => tx has swap & memo, b'00' => no swap & no memo
      this.swap ? this.swap.toBuffer('be', 32) : Buffer.from([]),
      this.memo ? this.memo.slice(0, 81) : Buffer.from([]),
    ])
  }

  hash(): Bytes32 {
    if (!this.proof) throw Error('SNARK is empty')
    if (!this.cache.hash) {
      const encodePacked = Buffer.concat([
        ...this.inflow.map(inflow => {
          return Buffer.concat([
            inflow.root.toBuffer('be', 32),
            inflow.nullifier.toBuffer('be', 32),
          ])
        }),
        ...this.outflow.map(outflow => {
          if (outflow.outflowType.eqn(OutflowType.UTXO)) {
            return outflow.note.toBuffer('be', 32)
          }
          if (!outflow.data)
            throw Error('Withdrawal or Migration should have data')
          return Buffer.concat([
            outflow.note.toBuffer('be', 32),
            outflow.data.to.toBuffer('be', 20),
            outflow.data.eth.toBuffer('be', 32),
            outflow.data.tokenAddr.toBuffer('be', 20),
            outflow.data.erc20Amount.toBuffer('be', 32),
            outflow.data.nft.toBuffer('be', 32),
            outflow.data.fee.toBuffer('be', 32),
          ])
        }),
        this.swap ? this.swap.toBuffer('be', 32) : Uint256.from('0').toBuffer(),
        this.proof.pi_a[0].toBuffer('be', 32),
        this.proof.pi_a[1].toBuffer('be', 32),
        // caution: snarkjs G2Point is reversed
        this.proof.pi_b[0][1].toBuffer('be', 32),
        this.proof.pi_b[0][0].toBuffer('be', 32),
        this.proof.pi_b[1][1].toBuffer('be', 32),
        this.proof.pi_b[1][0].toBuffer('be', 32),
        this.proof.pi_c[0].toBuffer('be', 32),
        this.proof.pi_c[1].toBuffer('be', 32),
        this.fee.toBuffer('be', 32),
      ])
      const hash = Bytes32.from(
        soliditySha3Raw(`0x${encodePacked.toString('hex')}`),
      )
      this.cache.hash = hash
    }
    if (!this.cache.hash) throw Error('Failed to compute hash')
    return this.cache.hash
  }

  size(): number {
    if (!this.cache.size) {
      this.cache.size = this.encode().length
    }
    return this.cache.size
  }

  signals(): bigint[] {
    /**
     * 
    signal input inclusion_references[n_i]; 
    signal input nullifiers[n_i]; // prevents double-spending

    signal input new_note_hash[n_o];
    signal input typeof_new_note[n_o]; // 0: UTXO, 1: Withdrawal, 2: Migration

    signal input public_data_to[n_o];
    signal input public_data_eth[n_o];
    signal input public_data_token_addr[n_o];
    signal input public_data_erc20[n_o];
    signal input public_data_erc721[n_o];
    signal input public_data_fee[n_o];

    signal input fee; // tx fee
    signal input swap; // for atomic swap
     */
    const signals: Field[] = [
      ...this.inflow.map(inflow => inflow.root),
      ...this.inflow.map(inflow => inflow.nullifier),
      ...this.outflow.map(outflow => outflow.note),
      ...this.outflow.map(outflow => outflow.outflowType),
      ...this.outflow.map(outflow =>
        outflow.data ? outflow.data.to : Field.zero,
      ),
      ...this.outflow.map(outflow =>
        outflow.data ? outflow.data.eth : Field.zero,
      ),
      ...this.outflow.map(outflow =>
        outflow.data ? outflow.data.tokenAddr : Field.zero,
      ),
      ...this.outflow.map(outflow =>
        outflow.data ? outflow.data.erc20Amount : Field.zero,
      ),
      ...this.outflow.map(outflow =>
        outflow.data ? outflow.data.nft : Field.zero,
      ),
      ...this.outflow.map(outflow =>
        outflow.data ? outflow.data.fee : Field.zero,
      ),
      this.fee,
      this.swap ? this.swap : Field.zero,
    ]
    return signals.map(f => f.toBigInt())
  }

  static decode(buff: Buffer): ZkTx {
    const zkTx: ZkTx = Object.create(ZkTx.prototype)
    const queue = new Utils.Queue(buff)
    // Inflow
    const nIn = queue.dequeue(1)[0]
    zkTx.inflow = []
    for (let i = 0; i < nIn; i += 1) {
      const root = Field.fromBuffer(queue.dequeue(32))
      const nullifier = Field.fromBuffer(queue.dequeue(32))
      zkTx.inflow.push({
        root,
        nullifier,
      })
    }
    // Outflow
    const nOut = queue.dequeue(1)[0]
    zkTx.outflow = []
    for (let i = 0; i < nOut; i += 1) {
      const note = Field.fromBuffer(queue.dequeue(32))
      const outflowType = Field.from(queue.dequeue(1)[0])
      if (!outflowType.isZero()) {
        zkTx.outflow.push({
          note,
          outflowType,
          data: {
            to: Field.fromBuffer(queue.dequeue(20)),
            eth: Field.fromBuffer(queue.dequeue(32)),
            tokenAddr: Field.fromBuffer(queue.dequeue(20)),
            erc20Amount: Field.fromBuffer(queue.dequeue(32)),
            nft: Field.fromBuffer(queue.dequeue(32)),
            fee: Field.fromBuffer(queue.dequeue(32)),
          },
        })
      } else {
        zkTx.outflow.push({
          note,
          outflowType,
        })
      }
    }
    // Fee
    zkTx.fee = Field.fromBuffer(queue.dequeue(32))
    // SNARK
    zkTx.proof = {
      pi_a: [
        Field.fromBuffer(queue.dequeue(32)),
        Field.fromBuffer(queue.dequeue(32)),
      ],
      // caution: snarkjs G2Point is reversed
      pi_b: [
        [
          Field.fromBuffer(queue.dequeue(32)),
          Field.fromBuffer(queue.dequeue(32)),
        ].reverse(),
        [
          Field.fromBuffer(queue.dequeue(32)),
          Field.fromBuffer(queue.dequeue(32)),
        ].reverse(),
      ],
      pi_c: [
        Field.fromBuffer(queue.dequeue(32)),
        Field.fromBuffer(queue.dequeue(32)),
      ],
    }
    // Swap
    const swapAndMemo = queue.dequeue(1)[0]
    if (swapAndMemo & 1) {
      zkTx.swap = Field.fromBuffer(queue.dequeue(32))
    }
    // Memo
    if (swapAndMemo & (1 << 1)) {
      zkTx.memo = queue.dequeue(81)
    }
    zkTx.cache = {
      size: buff.length,
    }
    return zkTx
  }

  circomProof(): {
    pi_a: bigint[]
    pi_b: bigint[][]
    pi_c: bigint[]
    protocol: string
  } {
    if (!this.proof) throw Error('Does not have SNARK proof')
    const bigOne = Field.from(1).toBigInt()
    const bigZero = Field.zero.toBigInt()
    return {
      pi_a: [...this.proof.pi_a.map(f => f.toBigInt()), bigOne],
      pi_b: [
        ...this.proof.pi_b.map(arr => arr.map(f => f.toBigInt())),
        [bigOne, bigZero],
      ],
      pi_c: [...this.proof.pi_c.map(f => f.toBigInt()), bigOne],
      protocol: 'groth16',
    }
  }
}
