import { randomHex } from 'web3-utils'
import * as circomlib from 'circomlib'
import * as chacha20 from 'chacha20'
import { Field, F, Point } from '@zkopru/babyjubjub'
import * as TokenUtils from './tokens'
import { ZkOutflow } from './zk_tx'

const poseidonHash = circomlib.poseidon.createHash(6, 8, 57, 'poseidon')

export enum OutflowType {
  UTXO = 0,
  WITHDRAWAL = 1,
  MIGRATION = 2,
}

export class Note {
  outflowType?: OutflowType

  eth: Field

  pubKey: Point

  salt: Field

  tokenAddr: Field

  erc20Amount: Field

  nft: Field

  constructor(
    eth: Field,
    salt: Field,
    tokenAddr: Field,
    erc20Amount: Field,
    nft: Field,
    pubKey: Point,
  ) {
    this.eth = eth
    this.pubKey = pubKey
    this.salt = salt
    this.tokenAddr = tokenAddr
    this.erc20Amount = erc20Amount
    this.nft = nft
  }

  static newEtherNote({
    eth,
    pubKey,
    salt,
  }: {
    eth: F
    pubKey: Point
    salt?: F
  }): Note {
    return new Note(
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
  }): Note {
    return new Note(
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
  }): Note {
    return new Note(
      Field.from(eth),
      salt ? Field.from(salt) : Field.from(randomHex(16)),
      Field.from(tokenAddr),
      Field.from(0),
      Field.from(nft),
      pubKey,
    )
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
    if (!this.outflowType) throw Error('outflow type is undefined')
    const outflowType: Field = Field.from(this.outflowType)
    const outflow = {
      note: this.hash(),
      outflowType,
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

  static fromJSON(data: string): Note {
    const obj = JSON.parse(data)
    return new Note(
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
  }): Note | null {
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
      const etherNote = Note.newEtherNote({
        eth: value,
        pubKey: myPubKey,
        salt,
      })
      if (utxoHash.equal(etherNote.hash())) {
        return etherNote
      }
    } else {
      const erc20Note = Note.newERC20Note({
        eth: Field.from(0),
        tokenAddr: tokenAddress,
        erc20Amount: value,
        pubKey: myPubKey,
        salt,
      })
      if (utxoHash.equal(erc20Note.hash())) {
        return erc20Note
      }
      const nftNote = Note.newNFTNote({
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
