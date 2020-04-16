import { Field, F, Point } from '@zkopru/babyjubjub'
import { Note, OutflowType } from './note'
import { Withdrawal } from './withdrawal'
import { Migration } from './migration'

export enum UtxoStatus {
  NON_INCLUDED = 0,
  UNSPENT = 1,
  SPENDING = 2,
  SPENT = 3,
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
}
