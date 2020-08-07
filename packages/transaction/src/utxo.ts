import { randomHex } from 'web3-utils'
import * as circomlib from 'circomlib'
import * as chacha20 from 'chacha20'
import { Field, F, Point } from '@zkopru/babyjubjub'
import { ZkAddress } from './zk-address'
import { Note, OutflowType, NoteStatus, Asset } from './note'
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

  constructor(owner: ZkAddress, salt: Field, asset: Asset, status: UtxoStatus) {
    super(owner, salt, asset)
    this.outflowType = OutflowType.UTXO
    this.status = status
  }

  static from(note: Note) {
    return new Utxo(note.owner, note.salt, note.asset, UtxoStatus.NON_INCLUDED)
  }

  toWithdrawal({ to, fee }: { to: F; fee: F }): Withdrawal {
    return new Withdrawal(this.owner, this.salt, this.asset, {
      to: Field.from(to),
      fee: Field.from(fee),
    })
  }

  toMigration({ to, fee }: { to: F; fee: F }): Migration {
    return new Migration(this.owner, this.salt, this.asset, {
      to: Field.from(to),
      fee: Field.from(fee),
    })
  }

  encrypt(): Buffer {
    const ephemeralSecretKey: Field = Field.from(randomHex(16))
    const sharedKey: Buffer = this.owner
      .viewingPubKey()
      .mul(ephemeralSecretKey)
      .encode()
    const tokenId = TokenUtils.getTokenId(this.asset.tokenAddr)
    const value = this.asset.eth || this.asset.erc20Amount || this.asset.nft
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

  nullifier(nullifierSeed: Field, leafIndex: Field): Field {
    const hash = poseidonHash([
      nullifierSeed.toIden3BigInt(),
      leafIndex.toIden3BigInt(),
    ]).toString()
    if (
      !this.owner.viewingPubKey().eq(Point.fromPrivKey(nullifierSeed.toHex(32)))
    ) {
      throw Error("Given nullifier does not match utxo's owner address")
    }
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
    spendingPubKey,
    viewingKey,
  }: {
    utxoHash: Field
    memo: Buffer
    spendingPubKey: Field
    viewingKey: Field
  }): Utxo | undefined {
    const multiplier = Point.getMultiplier(viewingKey.toHex(32))
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

    const owner = ZkAddress.from(
      spendingPubKey,
      Point.fromPrivKey(viewingKey.toHex(32)),
    )
    if (tokenAddress.isZero()) {
      const etherNote = Utxo.newEtherNote({
        owner,
        eth: value,
        salt,
      })
      if (utxoHash.eq(etherNote.hash())) {
        return etherNote
      }
    } else {
      const erc20Note = Utxo.newERC20Note({
        owner,
        eth: Field.from(0),
        tokenAddr: tokenAddress,
        erc20Amount: value,
        salt,
      })
      if (utxoHash.eq(erc20Note.hash())) {
        return erc20Note
      }
      const nftNote = Utxo.newNFTNote({
        owner,
        eth: Field.from(0),
        tokenAddr: tokenAddress,
        nft: value,
        salt,
      })
      if (utxoHash.eq(nftNote.hash())) {
        return nftNote
      }
    }
    return undefined
  }

  static newEtherNote({
    owner,
    eth,
    salt,
  }: {
    owner: ZkAddress
    eth: F
    salt?: F
  }): Utxo {
    const note = new Note(
      owner,
      salt ? Field.from(salt) : Field.from(randomHex(16)),
      {
        eth: Field.from(eth),
        tokenAddr: Field.from(0),
        erc20Amount: Field.from(0),
        nft: Field.from(0),
      },
    )
    return Utxo.from(note)
  }

  static newERC20Note({
    owner,
    eth,
    tokenAddr,
    erc20Amount,
    salt,
  }: {
    owner: ZkAddress
    eth: F
    tokenAddr: F
    erc20Amount: F
    salt?: F
  }): Utxo {
    const note = new Note(
      owner,
      salt ? Field.from(salt) : Field.from(randomHex(16)),
      {
        eth: Field.from(eth),
        tokenAddr: Field.from(tokenAddr),
        erc20Amount: Field.from(erc20Amount),
        nft: Field.from(0),
      },
    )
    return Utxo.from(note)
  }

  static newNFTNote({
    owner,
    eth,
    tokenAddr,
    nft,
    salt,
  }: {
    owner: ZkAddress
    eth: F
    tokenAddr: F
    nft: F
    salt?: F
  }): Utxo {
    const note = new Note(
      owner,
      salt ? Field.from(salt) : Field.from(randomHex(16)),
      {
        eth: Field.from(eth),
        tokenAddr: Field.from(tokenAddr),
        erc20Amount: Field.from(0),
        nft: Field.from(nft),
      },
    )
    return Utxo.from(note)
  }
}
