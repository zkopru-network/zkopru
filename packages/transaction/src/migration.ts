import { Field, F } from '@zkopru/babyjubjub'
import { ZkAddress } from './zk-address'
import { ZkOutflow } from './zk-tx'
import { Note, OutflowType, Asset } from './note'

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
    owner: ZkAddress,
    salt: Field,
    asset: Asset,
    publicData: {
      to: Field
      fee: Field
    },
  ) {
    super(owner, salt, asset)
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
        eth: this.asset.eth,
        tokenAddr: this.asset.tokenAddr,
        erc20Amount: this.asset.erc20Amount,
        nft: this.asset.nft,
        fee: this.publicData.fee,
      },
    }
    return outflow
  }

  static from(note: Note, to: F, fee: F): Migration {
    return new Migration(note.owner, note.salt, note.asset, {
      to: Field.from(to),
      fee: Field.from(fee),
    })
  }
}
