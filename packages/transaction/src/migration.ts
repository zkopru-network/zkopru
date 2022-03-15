import { Fp } from '@zkopru/babyjubjub'
import { BigNumberish } from 'ethers'
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
    to: Fp
    fee: Fp
  }

  static outflowType: Fp = Fp.from(2)

  constructor(
    owner: ZkAddress,
    salt: Fp,
    asset: Asset,
    publicData: {
      to: Fp
      fee: Fp
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

  static from(note: Note, to: BigNumberish, fee: BigNumberish): Migration {
    return new Migration(note.owner, note.salt, note.asset, {
      to: Fp.from(to),
      fee: Fp.from(fee),
    })
  }
}
