import { randomHex } from 'web3-utils'
import * as circomlib from 'circomlib'
import * as chacha20 from 'chacha20'
import { Field, F, Point } from '@zkopru/babyjubjub'
import { Note, OutflowType, NoteStatus } from './note'
import { Withdrawal } from './withdrawal'
import { Migration } from './migration'
import * as TokenUtils from './tokens'
import { ZkOutflow } from './zk_tx'

const poseidonHash = circomlib.poseidon.createHash(6, 8, 57)

export enum UtxoStatus {
  NON_INCLUDED = NoteStatus.NON_INCLUDED,
  UNSPENT = NoteStatus.UNSPENT,
  SPENDING = NoteStatus.SPENDING,
  SPENT = NoteStatus.SPENT,
}

export class Utxo extends Note {
  status: UtxoStatus

  constructor(
    eth: Field,
    salt: Field,
    tokenAddr: Field,
    erc20Amount: Field,
    nft: Field,
    pubKey: Point,
    status: UtxoStatus,
  ) {
    super(eth, salt, tokenAddr, erc20Amount, nft, pubKey)
    this.outflowType = OutflowType.UTXO
    this.status = status
  }

  static from(note: Note) {
    return new Utxo(
      note.eth,
      note.salt,
      note.tokenAddr,
      note.erc20Amount,
      note.nft,
      note.pubKey,
      UtxoStatus.NON_INCLUDED,
    )
  }

  toWithdrawal({ to, fee }: { to: F; fee: F }): Withdrawal {
    return new Withdrawal(
      this.eth,
      this.salt,
      this.tokenAddr,
      this.erc20Amount,
      this.nft,
      this.pubKey,
      {
        to: Field.from(to),
        fee: Field.from(fee),
      },
    )
  }

  toMigration({ to, fee }: { to: F; fee: F }): Migration {
    return new Migration(
      this.eth,
      this.salt,
      this.tokenAddr,
      this.erc20Amount,
      this.nft,
      this.pubKey,
      {
        to: Field.from(to),
        fee: Field.from(fee),
      },
    )
  }

  encrypt(): Buffer {
    const ephemeralSecretKey: Field = Field.from(randomHex(16))
    const sharedKey: Buffer = this.pubKey.mul(ephemeralSecretKey).encode()
    const tokenId = TokenUtils.getTokenId(this.tokenAddr)
    const value = this.eth || this.erc20Amount || this.nft
    const secret = [
      this.salt.toBuffer('be', 16),
      Field.from(tokenId).toBuffer('be', 1),
      value.toBuffer('be', 32),
    ]
    const ciphertext = chacha20.encrypt(sharedKey, 0, Buffer.concat(secret))
    const encryptedMemo = Buffer.concat([
      Point.generate(ephemeralSecretKey).encode(),
      ciphertext,
    ])
    // 32bytes ephemeral pub key + 16 bytes salt + 1 byte token id + 32 bytes toIden3BigInt()ue = 81 bytes
    return encryptedMemo
  }

  nullifier(): Field {
    const hash = poseidonHash([
      this.hash().toIden3BigInt(),
      this.salt.toIden3BigInt(),
    ]).toString()
    const val = Field.from(hash)
    return val
  }

  toZkOutflow(): ZkOutflow {
    const outflowType: Field = Field.from(OutflowType.UTXO)
    const outflow = {
      note: this.hash(),
      outflowType,
    }
    return outflow
  }

  static decrypt({
    utxoHash,
    memo,
    privKey,
  }: {
    utxoHash: Field
    memo: Buffer
    privKey: string
  }): Utxo | undefined {
    const multiplier = Point.getMultiplier(privKey)
    const ephemeralPubKey = Point.decode(memo.subarray(0, 32))
    const sharedKey = ephemeralPubKey.mul(multiplier).encode()
    const data = memo.subarray(32, 81)
    const decrypted = chacha20.decrypt(sharedKey, 0, data)
    const salt = Field.fromBuffer(decrypted.subarray(0, 16))
    const tokenAddress = TokenUtils.getTokenAddress(
      decrypted.subarray(16, 17)[0],
    )
    if (tokenAddress === null) {
      return
    }
    const value = Field.fromBuffer(decrypted.subarray(17, 49))

    const myPubKey: Point = Point.fromPrivKey(privKey)
    if (tokenAddress.isZero()) {
      const etherNote = Utxo.newEtherNote({
        eth: value,
        pubKey: myPubKey,
        salt,
      })
      if (utxoHash.eq(etherNote.hash())) {
        return etherNote
      }
    } else {
      const erc20Note = Utxo.newERC20Note({
        eth: Field.from(0),
        tokenAddr: tokenAddress,
        erc20Amount: value,
        pubKey: myPubKey,
        salt,
      })
      if (utxoHash.eq(erc20Note.hash())) {
        return erc20Note
      }
      const nftNote = Utxo.newNFTNote({
        eth: Field.from(0),
        tokenAddr: tokenAddress,
        nft: value,
        pubKey: myPubKey,
        salt,
      })
      if (utxoHash.eq(nftNote.hash())) {
        return nftNote
      }
    }
    return undefined
  }

  static newEtherNote({
    eth,
    pubKey,
    salt,
  }: {
    eth: F
    pubKey: Point
    salt?: F
  }): Utxo {
    const note = new Note(
      Field.from(eth),
      salt ? Field.from(salt) : Field.from(randomHex(16)),
      Field.from(0),
      Field.from(0),
      Field.from(0),
      pubKey,
    )
    return Utxo.from(note)
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
  }): Utxo {
    const note = new Note(
      Field.from(eth),
      salt ? Field.from(salt) : Field.from(randomHex(16)),
      Field.from(tokenAddr),
      Field.from(erc20Amount),
      Field.from(0),
      pubKey,
    )
    return Utxo.from(note)
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
  }): Utxo {
    const note = new Note(
      Field.from(eth),
      salt ? Field.from(salt) : Field.from(randomHex(16)),
      Field.from(tokenAddr),
      Field.from(0),
      Field.from(nft),
      pubKey,
    )
    return Utxo.from(note)
  }
}
