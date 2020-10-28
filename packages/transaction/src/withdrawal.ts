import { Field, F } from '@zkopru/babyjubjub'
import { Uint256, Bytes32 } from 'soltypes'
import { soliditySha3 } from 'web3-utils'
import { ZkAddress } from './zk-address'
import { ZkOutflow, PublicData } from './zk-tx'
import { Note, OutflowType, NoteStatus, Asset } from './note'

export enum WithdrawalStatus {
  NON_INCLUDED = NoteStatus.NON_INCLUDED,
  UNFINALIZED = NoteStatus.WAITING_FINALIZATION,
  WITHDRAWABLE = NoteStatus.WITHDRAWABLE,
  TRANSFERRED = NoteStatus.TRANSFERRED,
  WITHDRAWN = NoteStatus.WITHDRAWN,
}

export class Withdrawal extends Note {
  status: WithdrawalStatus

  publicData: {
    to: Field
    fee: Field
  }

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
    this.outflowType = OutflowType.WITHDRAWAL
    this.status = WithdrawalStatus.NON_INCLUDED
  }

  toZkOutflow(): ZkOutflow {
    const outflow = {
      note: this.hash(),
      outflowType: Field.from(OutflowType.WITHDRAWAL),
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

  withdrawalHash(): Uint256 {
    return Withdrawal.withdrawalHash(this.hash(), {
      to: this.publicData.to,
      eth: this.asset.eth,
      tokenAddr: this.asset.tokenAddr,
      erc20Amount: this.asset.erc20Amount,
      nft: this.asset.nft,
      fee: this.publicData.fee,
    })
  }

  static withdrawalHash(note: Field, publicData: PublicData): Uint256 {
    const concatenated = Buffer.concat([
      note.toBuffer(),
      publicData.to.toAddress().toBuffer(),
      publicData.eth.toBytes32().toBuffer(),
      publicData.tokenAddr.toAddress().toBuffer(),
      publicData.erc20Amount.toBytes32().toBuffer(),
      publicData.nft.toBytes32().toBuffer(),
      publicData.fee.toBytes32().toBuffer(),
    ])
    const result = soliditySha3(`0x${concatenated.toString('hex')}`)
    //  uint256 note = uint256(keccak256(abi.encodePacked(owner, eth, token, amount, nft, fee)));
    if (result === null) throw Error('hash result is null')
    return Bytes32.from(result).toUint()
  }

  static from(note: Note, to: F, fee: F): Withdrawal {
    return new Withdrawal(note.owner, note.salt, note.asset, {
      to: Field.from(to),
      fee: Field.from(fee),
    })
  }
}
