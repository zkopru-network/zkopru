import * as circomlib from 'circomlib'
import { Field, Point } from '@zkopru/babyjubjub'
import { NoteSql } from '@zkopru/prisma'

const poseidonHash = circomlib.poseidon.createHash(6, 8, 57)

export enum OutflowType {
  UTXO = 0,
  WITHDRAWAL = 1,
  MIGRATION = 2,
}

export enum NoteStatus {
  NON_INCLUDED = 0,
  UNSPENT = 1,
  SPENDING = 2,
  SPENT = 3,
  WAITING_FINALIZATION = 4,
  WITHDRAWABLE = 5,
  TRANSFERRED = 6,
  WITHDRAWN = 7,
}

export class Note {
  outflowType: OutflowType

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
    this.outflowType = OutflowType.UTXO
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

  hash(): Field {
    const firstHash = Field.from(
      poseidonHash([
        this.eth.toIden3BigInt(),
        this.pubKey.x.toIden3BigInt(),
        this.pubKey.y.toIden3BigInt(),
        this.salt.toIden3BigInt(),
      ]).toString(),
    )
    const resultHash = Field.from(
      poseidonHash([
        firstHash.toIden3BigInt(),
        this.tokenAddr.toIden3BigInt(),
        this.erc20Amount.toIden3BigInt(),
        this.nft.toIden3BigInt(),
      ]).toString(),
    )
    return resultHash
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

  static fromSql(obj: NoteSql): Note | undefined {
    const { eth, salt, tokenAddr, erc20Amount, nft, pubKey } = obj
    if (eth && salt && tokenAddr && erc20Amount && nft && pubKey)
      return new Note(
        Field.from(eth),
        Field.from(salt),
        Field.from(tokenAddr),
        Field.from(erc20Amount),
        Field.from(nft),
        Point.fromHex(pubKey),
      )
    return undefined
  }
}
