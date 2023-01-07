import { poseidon } from 'circomlib'
import * as chacha20 from 'chacha20'
import { BigNumberish } from 'ethers'
import { Fp, Fr, Point } from '@zkopru/babyjubjub'
import crypto from 'crypto'
import { ZkAddress } from './zk-address'
import { Note, OutflowType, NoteStatus, Asset } from './note'
import { Withdrawal } from './withdrawal'
import { Migration } from './migration'
import { ZkOutflow } from './zk-tx'
import { TokenRegistry } from './tokens'

export enum UtxoStatus {
  NON_INCLUDED = NoteStatus.NON_INCLUDED,
  UNSPENT = NoteStatus.UNSPENT,
  SPENDING = NoteStatus.SPENDING,
  SPENT = NoteStatus.SPENT,
}

export class Utxo extends Note {
  status: UtxoStatus

  constructor(owner: ZkAddress, salt: Fp, asset: Asset, status: UtxoStatus) {
    super(owner, salt, asset)
    this.outflowType = OutflowType.UTXO
    this.status = status
  }

  static from(note: Note) {
    return new Utxo(note.owner, note.salt, note.asset, UtxoStatus.NON_INCLUDED)
  }

  toWithdrawal({
    to,
    fee,
  }: {
    to: BigNumberish
    fee: BigNumberish
  }): Withdrawal {
    return new Withdrawal(this.owner, this.salt, this.asset, {
      to: Fp.from(to),
      fee: Fp.from(fee),
    })
  }

  toMigration({ to, fee }: { to: BigNumberish; fee: BigNumberish }): Migration {
    return new Migration(this.owner, this.salt, this.asset, {
      to: Fp.from(to),
      fee: Fp.from(fee),
    })
  }

  encrypt(): Buffer {
    const ephemeralSecretKey: Fr = Fr.from(crypto.randomBytes(16))
    const sharedKey: Buffer = this.owner
      .viewingPubKey()
      .mul(ephemeralSecretKey)
      .encode()
    const tokenId = TokenRegistry.getTokenId(this.asset.tokenAddr)
    let value: Fp
    if (this.asset.eth.gt(0)) {
      value = this.asset.eth
    } else if (this.asset.erc20Amount.gt(0)) {
      value = this.asset.erc20Amount
    } else {
      value = this.asset.nft
    }
    const secret = [
      this.salt.toBuffer('be', 16),
      Fp.from(tokenId).toBuffer('be', 1),
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

  nullifier(nullifierSeed: Fr, leafIndex: Fp): Fp {
    const hash = poseidon([
      nullifierSeed.toBigInt(),
      leafIndex.toBigInt(),
    ]).toString()
    if (!this.owner.viewingPubKey().eq(Point.BASE8.mul(nullifierSeed))) {
      throw Error("Given nullifier does not match utxo's owner address")
    }
    const val = Fp.from(hash)
    return val
  }

  toZkOutflow(): ZkOutflow {
    const outflowType: Fp = Fp.from(OutflowType.UTXO)
    const outflow = {
      note: this.hash(),
      outflowType,
    }
    return outflow
  }

  static nullifier(nullifierSeed: Fp, leafIndex: Fp): Fp {
    const hash = poseidon([
      nullifierSeed.toBigInt(),
      leafIndex.toBigInt(),
    ]).toString()
    const val = Fp.from(hash)
    return val
  }

  static decrypt({
    utxoHash,
    memo,
    spendingPubKey,
    viewingKey,
    tokenRegistry,
  }: {
    utxoHash: Fp
    memo: Buffer
    spendingPubKey: Fp
    viewingKey: Fr
    tokenRegistry: TokenRegistry
  }): Utxo | undefined {
    const ephemeralPubKey = Point.decode(memo.subarray(0, 32))
    const sharedKey = ephemeralPubKey.mul(viewingKey).encode()
    const data = memo.subarray(32, 81)
    const decrypted = chacha20.decrypt(sharedKey, 0, data)
    const salt = Fp.fromBuffer(decrypted.subarray(0, 16))
    const tokenIdentifier = decrypted.subarray(16, 17)[0]
    const value = Fp.fromBuffer(decrypted.subarray(17, 49))

    const owner = ZkAddress.from(spendingPubKey, Point.BASE8.mul(viewingKey))
    // Return an Ether note if it is an Ether note
    const etherNote = Utxo.newEtherNote({
      owner,
      eth: value,
      salt,
    })
    if (utxoHash.eq(etherNote.hash())) {
      return etherNote
    }
    // Try to find ERC20 or ERC721 notes
    const erc20Addresses = tokenRegistry.getErc20Addresses(tokenIdentifier)
    for (const tokenAddr of erc20Addresses) {
      const erc20Note = Utxo.newERC20Note({
        owner,
        eth: Fp.from(0),
        tokenAddr,
        erc20Amount: value,
        salt,
      })
      if (utxoHash.eq(erc20Note.hash())) {
        return erc20Note
      }
    }
    const erc721Addresses = tokenRegistry.getErc721Addresses(tokenIdentifier)
    for (const tokenAddr of erc721Addresses) {
      const nftNote = Utxo.newNFTNote({
        owner,
        eth: Fp.from(0),
        tokenAddr,
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
    eth: BigNumberish
    salt?: BigNumberish
  }): Utxo {
    const note = new Note(
      owner,
      salt ? Fp.from(salt) : Fp.from(crypto.randomBytes(16)),
      {
        eth: Fp.from(eth),
        tokenAddr: Fp.from(0),
        erc20Amount: Fp.from(0),
        nft: Fp.from(0),
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
    eth: BigNumberish
    tokenAddr: BigNumberish
    erc20Amount: BigNumberish
    salt?: BigNumberish
  }): Utxo {
    const note = new Note(
      owner,
      salt ? Fp.from(salt) : Fp.from(crypto.randomBytes(16)),
      {
        eth: Fp.from(eth),
        tokenAddr: Fp.from(tokenAddr),
        erc20Amount: Fp.from(erc20Amount),
        nft: Fp.from(0),
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
    eth: BigNumberish
    tokenAddr: BigNumberish
    nft: BigNumberish
    salt?: BigNumberish
  }): Utxo {
    const note = new Note(
      owner,
      salt ? Fp.from(salt) : Fp.from(crypto.randomBytes(16)),
      {
        eth: Fp.from(eth),
        tokenAddr: Fp.from(tokenAddr),
        erc20Amount: Fp.from(0),
        nft: Fp.from(nft),
      },
    )
    return Utxo.from(note)
  }
}
