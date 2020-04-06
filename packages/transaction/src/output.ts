import { randomHex } from 'web3-utils'
import * as circomlib from 'circomlib'
import * as chacha20 from 'chacha20'
import { Field, F, Point } from '@zkopru/babyjubjub'
import * as TokenUtils from './tokens'
import { ZkOutflow } from './zk_tx'

const poseidonHash = circomlib.poseidon.createHash(6, 8, 57, 'poseidon')

export enum OutputStatus {
  NON_INCLUDED = 0,
  UNSPENT = 1,
  SPENDING = 2,
  SPENT = 3,
}

export class Output {
  eth: Field

  pubKey: Point

  salt: Field

  tokenAddr: Field

  erc20Amount: Field

  nft: Field

  publicData?: {
    isWithdrawal: boolean
    to: Field
    fee: Field
  }

  status?: OutputStatus

  constructor(
    eth: Field,
    salt: Field,
    tokenAddr: Field,
    erc20Amount: Field,
    nft: Field,
    pubKey: Point,
    publicData?: {
      isWithdrawal: boolean
      to: Field
      fee: Field
    },
    status?: OutputStatus,
  ) {
    this.eth = eth
    this.pubKey = pubKey
    this.salt = salt
    this.tokenAddr = tokenAddr
    this.erc20Amount = erc20Amount
    this.nft = nft
    this.publicData = publicData || undefined
    this.status = status || OutputStatus.NON_INCLUDED
  }

  static newEtherNote({
    eth,
    pubKey,
    salt,
  }: {
    eth: F
    pubKey: Point
    salt?: F
  }): Output {
    return new Output(
      Field.from(eth),
      salt ? Field.from(salt) : Field.from(randomHex(16)),
      Field.from(0),
      Field.from(0),
      Field.from(0),
      pubKey,
    )
  }

  static newERC20Note({
    eth,
    tokenAddr,
    erc20Amount,
    pubKey,
    salt,
  }: {
    eth: F
    tokenAddr: F
    erc20Amount: F
    pubKey: Point
    salt?: F
  }): Output {
    return new Output(
      Field.from(eth),
      salt ? Field.from(salt) : Field.from(randomHex(16)),
      Field.from(tokenAddr),
      Field.from(erc20Amount),
      Field.from(0),
      pubKey,
    )
  }

  static newNFTNote({
    eth,
    tokenAddr,
    nft,
    pubKey,
    salt,
  }: {
    eth: F
    tokenAddr: F
    nft: F
    pubKey: Point
    salt?: F
  }): Output {
    return new Output(
      Field.from(eth),
      salt ? Field.from(salt) : Field.from(randomHex(16)),
      Field.from(tokenAddr),
      Field.from(0),
      Field.from(nft),
      pubKey,
    )
  }

  markAsWithdrawal({ to, fee }: { to: F; fee: F }) {
    this.publicData = {
      isWithdrawal: true,
      to: Field.from(to),
      fee: Field.from(fee),
    }
  }

  markAsMigration({ to, fee }: { to: F; fee: F }) {
    this.publicData = {
      isWithdrawal: false,
      to: Field.from(to),
      fee: Field.from(fee),
    }
  }

  markAsInternalUtxo() {
    this.publicData = undefined
  }

  hash(): Field {
    const firstHash = Field.from(
      poseidonHash([
        this.eth.val,
        this.pubKey.x.val,
        this.pubKey.y.val,
        this.salt.val,
      ]),
    )
    const resultHash = Field.from(
      poseidonHash([
        firstHash.val,
        this.tokenAddr.val,
        this.erc20Amount.val,
        this.nft.val,
      ]),
    )
    return resultHash
  }

  nullifier(): Field {
    return Field.from(poseidonHash([this.hash(), this.salt.val]))
  }

  encrypt(): Buffer {
    const ephemeralSecretKey: Field = Field.from(randomHex(16))
    const sharedKey: Buffer = this.pubKey.mul(ephemeralSecretKey).encode()
    const tokenId = TokenUtils.getTokenId(this.tokenAddr)
    const value = this.eth || this.erc20Amount || this.nft
    const secret = [
      this.salt.toBuffer(16),
      Field.from(tokenId).toBuffer(1),
      value.toBuffer(32),
    ]
    const ciphertext = chacha20.encrypt(sharedKey, 0, Buffer.concat(secret))
    const encryptedMemo = Buffer.concat([
      Point.generate(ephemeralSecretKey).encode(),
      ciphertext,
    ])
    // 32bytes ephemeral pub key + 16 bytes salt + 1 byte token id + 32 bytes value = 81 bytes
    return encryptedMemo
  }

  toZkOutflow(): ZkOutflow {
    let outflow
    if (this.publicData) {
      outflow = {
        note: this.hash(),
        outflowType: this.outflowType(),
        data: {
          to: this.publicData.to,
          eth: this.eth,
          tokenAddr: this.tokenAddr,
          erc20Amount: this.erc20Amount,
          nft: this.nft,
          fee: this.publicData.fee,
        },
      }
    } else {
      outflow = {
        note: this.hash(),
        outflowType: this.outflowType(),
      }
    }
    return outflow
  }

  toJSON(): string {
    return JSON.stringify({
      eth: this.eth,
      salt: this.salt,
      token: this.tokenAddr,
      amount: this.erc20Amount,
      nft: this.nft.toHex(),
      pubKey: {
        x: this.pubKey.x,
        y: this.pubKey.y,
      },
    })
  }

  outflowType(): Field {
    if (this.publicData) {
      if (this.publicData.isWithdrawal) {
        return Field.from(1) // Withdrawal
      }
      return Field.from(2) // Migration
    }
    return Field.from(0) // UTXO
  }

  static fromJSON(data: string): Output {
    const obj = JSON.parse(data)
    return new Output(
      obj.eth,
      obj.salt,
      obj.token,
      obj.amount,
      obj.nft,
      new Point(obj.pubKey.x, obj.pubKey.y),
    )
  }

  static decrypt({
    utxoHash,
    memo,
    privKey,
  }: {
    utxoHash: Field
    memo: Buffer
    privKey: string
  }): Output | null {
    const multiplier = Point.getMultiplier(privKey)
    const ephemeralPubKey = Point.decode(memo.subarray(0, 32))
    const sharedKey = ephemeralPubKey.mul(multiplier).encode()
    const data = memo.subarray(32, 81)
    const decrypted = chacha20.decrypt(sharedKey, 0, data) // prints "testing"

    const salt = Field.fromBuffer(decrypted.subarray(0, 16))
    const tokenAddress = TokenUtils.getTokenAddress(
      decrypted.subarray(16, 17)[0],
    )
    if (tokenAddress === null) return null
    const value = Field.fromBuffer(decrypted.subarray(17, 49))

    const myPubKey: Point = Point.fromPrivKey(privKey)
    if (tokenAddress.isZero()) {
      const etherNote = Output.newEtherNote({
        eth: value,
        pubKey: myPubKey,
        salt,
      })
      if (utxoHash.equal(etherNote.hash())) {
        return etherNote
      }
    } else {
      const erc20Note = Output.newERC20Note({
        eth: Field.from(0),
        tokenAddr: tokenAddress,
        erc20Amount: value,
        pubKey: myPubKey,
        salt,
      })
      if (utxoHash.equal(erc20Note.hash())) {
        return erc20Note
      }
      const nftNote = Output.newNFTNote({
        eth: Field.from(0),
        tokenAddr: tokenAddress,
        nft: value,
        pubKey: myPubKey,
        salt,
      })
      if (utxoHash.equal(nftNote.hash())) {
        return nftNote
      }
    }
    return null
  }
}
