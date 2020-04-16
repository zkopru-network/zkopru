import { Field, Point, F } from '@zkopru/babyjubjub'
import { ZkOutflow } from './zk_tx'
import { Note, OutflowType } from './note'

export enum WithdrawalStatus {
  NON_INCLUDED = 0,
  INCLUDED = 1,
}

export class Withdrawal extends Note {
  status: WithdrawalStatus

  publicData: {
    to: Field
    fee: Field
  }

  static outflowType: Field = Field.from(1)

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
    this.outflowType = OutflowType.WITHDRAWAL
    this.status = WithdrawalStatus.NON_INCLUDED
  }

  toZkOutflow(): ZkOutflow {
    const outflow = {
      note: this.hash(),
      outflowType: Withdrawal.outflowType,
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

  static from(note: Note, to: F, fee: F): Withdrawal {
    return new Withdrawal(
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
