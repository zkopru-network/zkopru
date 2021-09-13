/* eslint-disable @typescript-eslint/camelcase */
import { soliditySha3Raw } from 'web3-utils'
import { Fp } from '@zkopru/babyjubjub'
import * as Utils from '@zkopru/utils'
import { Bytes4, Bytes32, Uint256 } from 'soltypes'
import { OutflowType } from './note'
import {
  Memo,
  MemoVersion,
  V2_MEMO_DEFAULT_ABI,
  V2_MEMO_WITHDRAW_SIG_ABI,
  V2_MEMO_DEFAULT_ABI_ZERO,
  V2_MEMO_WITHDRAW_SIG_ABI_ZERO,
} from './memo'

export interface ZkInflow {
  nullifier: Fp
  root: Fp
}

export interface ZkOutflow {
  note: Fp
  outflowType: Fp
  data?: PublicData
}

export interface PublicData {
  to: Fp
  eth: Fp
  tokenAddr: Fp
  erc20Amount: Fp
  nft: Fp
  fee: Fp
}

export interface SNARK {
  pi_a: Fp[]
  pi_b: Fp[][]
  pi_c: Fp[]
}

export class ZkTx {
  inflow: ZkInflow[]

  outflow: ZkOutflow[]

  fee: Fp

  proof?: SNARK

  swap?: Fp

  memo?: Memo

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
    fee: Fp
    proof?: SNARK
    swap?: Fp
    memo?: Memo
  }) {
    this.inflow = inflow
    this.outflow = outflow
    this.fee = fee
    this.proof = proof
    this.swap = swap
    this.memo = memo
    this.cache = {}
  }

  toJSON() {
    return {
      hash: this.hash(),
      size: this.size(),
      inflow: this.inflow,
      outflow: this.outflow,
      fee: this.fee,
      proof: this.proof,
      swap: this.swap,
      memo: this.memo
        ? {
            version: this.memo.version,
            data: this.memo.data.toString('base64'),
          }
        : undefined,
    }
  }

  encode(): Buffer {
    if (!this.proof) throw Error('SNARK does not exist')
    let switchForSwapAndMemo = 0
    if (this.swap) switchForSwapAndMemo += 1
    let memo: Buffer
    if (this.memo?.version === 1) {
      switchForSwapAndMemo += 2
      memo = this.memo.data
    } else if (this.memo?.version === 2) {
      switchForSwapAndMemo += 4
      memo = Buffer.concat([
        Fp.from(this.memo.data.length).toBuffer('be', 2),
        this.memo.data,
      ])
    } else {
      memo = Buffer.from([])
    }

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
      Uint8Array.from([switchForSwapAndMemo]), // b'11' => tx has swap & memo, b'00' => no swap & no memo
      this.swap ? this.swap.toBuffer('be', 32) : Buffer.from([]),
      memo,
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
    const signals: Fp[] = [
      ...this.inflow.map(inflow => inflow.root),
      ...this.inflow.map(inflow => inflow.nullifier),
      ...this.outflow.map(outflow => outflow.note),
      ...this.outflow.map(outflow => outflow.outflowType),
      ...this.outflow.map(outflow =>
        outflow.data ? outflow.data.to : Fp.zero,
      ),
      ...this.outflow.map(outflow =>
        outflow.data ? outflow.data.eth : Fp.zero,
      ),
      ...this.outflow.map(outflow =>
        outflow.data ? outflow.data.tokenAddr : Fp.zero,
      ),
      ...this.outflow.map(outflow =>
        outflow.data ? outflow.data.erc20Amount : Fp.zero,
      ),
      ...this.outflow.map(outflow =>
        outflow.data ? outflow.data.nft : Fp.zero,
      ),
      ...this.outflow.map(outflow =>
        outflow.data ? outflow.data.fee : Fp.zero,
      ),
      this.fee,
      this.swap ? this.swap : Fp.zero,
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
      const root = Fp.fromBuffer(queue.dequeue(32))
      const nullifier = Fp.fromBuffer(queue.dequeue(32))
      zkTx.inflow.push({
        root,
        nullifier,
      })
    }
    // Outflow
    const nOut = queue.dequeue(1)[0]
    zkTx.outflow = []
    for (let i = 0; i < nOut; i += 1) {
      const note = Fp.fromBuffer(queue.dequeue(32))
      const outflowType = Fp.from(queue.dequeue(1)[0])
      if (!outflowType.isZero()) {
        zkTx.outflow.push({
          note,
          outflowType,
          data: {
            to: Fp.fromBuffer(queue.dequeue(20)),
            eth: Fp.fromBuffer(queue.dequeue(32)),
            tokenAddr: Fp.fromBuffer(queue.dequeue(20)),
            erc20Amount: Fp.fromBuffer(queue.dequeue(32)),
            nft: Fp.fromBuffer(queue.dequeue(32)),
            fee: Fp.fromBuffer(queue.dequeue(32)),
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
    zkTx.fee = Fp.fromBuffer(queue.dequeue(32))
    // SNARK
    zkTx.proof = {
      pi_a: [
        Fp.fromBuffer(queue.dequeue(32)),
        Fp.fromBuffer(queue.dequeue(32)),
      ],
      // caution: snarkjs G2Point is reversed
      pi_b: [
        [
          Fp.fromBuffer(queue.dequeue(32)),
          Fp.fromBuffer(queue.dequeue(32)),
        ].reverse(),
        [
          Fp.fromBuffer(queue.dequeue(32)),
          Fp.fromBuffer(queue.dequeue(32)),
        ].reverse(),
      ],
      pi_c: [
        Fp.fromBuffer(queue.dequeue(32)),
        Fp.fromBuffer(queue.dequeue(32)),
      ],
    }
    // bit switch for swap and memo field: https://github.com/zkopru-network/zkopru/issues/218
    const swapAndMemo = queue.dequeue(1)[0]
    // Swap
    if (swapAndMemo & 1) {
      zkTx.swap = Fp.fromBuffer(queue.dequeue(32))
    }
    // Memo
    if (swapAndMemo & (1 << 1)) {
      // v1
      zkTx.memo = {
        version: 1,
        data: queue.dequeue(81),
      }
    } else if (swapAndMemo & (1 << 2)) {
      // v2
      const len = parseInt(`0x${queue.dequeue(2).toString('hex')}`, 16)
      zkTx.memo = {
        version: 2,
        data: queue.dequeue(len),
      }
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
    const bigOne = Fp.from(1).toBigInt()
    const bigZero = Fp.zero.toBigInt()
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

  parseMemo(): {
    encryptedNotes: Buffer[]
    prepayInfo?: {
      prepayFeeInEth: Fp
      prepayFeeInToken: Fp
      expiration: number
      signature: Buffer
    }
  } {
    if (!this.memo)
      return {
        encryptedNotes: [],
      }
    if (this.memo.version === MemoVersion.V1) {
      return {
        encryptedNotes: [this.memo.data],
      }
    }
    if (this.memo.version !== MemoVersion.V2) {
      throw new Error(`Unrecognized memo version: ${this.memo.version}`)
    }
    const memoSig = Bytes4.from(
      `0x${this.memo.data.slice(0, 4).toString('hex')}`,
    )
    if (
      V2_MEMO_DEFAULT_ABI.eq(memoSig) ||
      V2_MEMO_DEFAULT_ABI_ZERO.eq(memoSig)
    ) {
      return {
        encryptedNotes: Array((this.memo.data.length - 4) / 81)
          .fill(null)
          .map((_, index) => {
            if (!this.memo) throw new Error('Expected memo to exist')
            return this.memo.data.subarray(4 + index * 81, 4 + (index + 1) * 81)
          }),
      }
    }
    if (
      V2_MEMO_WITHDRAW_SIG_ABI.eq(memoSig) ||
      V2_MEMO_WITHDRAW_SIG_ABI_ZERO.eq(memoSig)
    ) {
      const queue = new Utils.StringifiedHexQueue(
        `0x${this.memo.data.toString('hex')}`,
      )
      // dequeue the abi sig
      queue.dequeue(4)
      const prepayEthFee = Fp.from(queue.dequeue(32))
      const prepayTokenFee = Fp.from(queue.dequeue(32))
      const expiration = queue.dequeueToNumber(8)
      const sigLength = queue.dequeueToNumber(9)
      const signature = queue.dequeueToBuffer(sigLength)
      // dequeue the signature padding
      queue.dequeue(81 - (sigLength % 81))
      const noteData = queue.dequeueAllToBuffer()
      return {
        encryptedNotes: Array(noteData.length / 81)
          .fill(null)
          .map((_, index) => {
            return noteData.subarray(index * 81, (index + 1) * 81)
          }),
        prepayInfo: {
          prepayFeeInEth: prepayEthFee,
          prepayFeeInToken: prepayTokenFee,
          expiration,
          signature,
        },
      }
    }
    throw new Error(`Unrecognized v2 memo signature: ${memoSig.toString()}`)
  }
}
