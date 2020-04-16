import { Field, Point, F } from '@zkopru/babyjubjub'
import { ZkOutflow } from './zk_tx'
import { Note, OutflowType } from './note'

export enum MigrationStatus {
  NON_INCLUDED = 0,
  INCLUDED = 1,
}

export class Migration extends Note {
  status: MigrationStatus

  publicData: {
    to: Field
    fee: Field
  }

  static outflowType: Field = Field.from(2)

  constructor(
    eth: Field,
    salt: Field,
    tokenAddr: Field,
    erc20Amount: Field,
    nft: Field,
    pubKey: Point,
    publicData: {
      to: Field
      fee: Field
    },
  ) {
    super(eth, salt, tokenAddr, erc20Amount, nft, pubKey)
    this.publicData = publicData
    this.outflowType = OutflowType.MIGRATION
    this.status = MigrationStatus.NON_INCLUDED
  }

  toZkOutflow(): ZkOutflow {
    const outflow = {
      note: this.hash(),
      outflowType: Migration.outflowType,
      data: {
        to: this.publicData.to,
        eth: this.eth,
        tokenAddr: this.tokenAddr,
        erc20Amount: this.erc20Amount,
        nft: this.nft,
        fee: this.publicData.fee,
      },
    }
    return outflow
  }

  static from(note: Note, to: F, fee: F): Migration {
    return new Migration(
      note.eth,
      note.salt,
      note.tokenAddr,
      note.erc20Amount,
      note.nft,
      note.pubKey,
      {
        to: Field.from(to),
        fee: Field.from(fee),
      },
    )
  }
}
