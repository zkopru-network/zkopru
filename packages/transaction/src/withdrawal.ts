import { Fp } from '@zkopru/babyjubjub'
import { BigNumberish, ethers } from 'ethers'
import { Uint256, Bytes32 } from 'soltypes'
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
    to: Fp
    fee: Fp
  }

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
    this.outflowType = OutflowType.WITHDRAWAL
    this.status = WithdrawalStatus.NON_INCLUDED
  }

  toZkOutflow(): ZkOutflow {
    const outflow = {
      note: this.hash(),
      outflowType: Fp.from(OutflowType.WITHDRAWAL),
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

  static withdrawalHash(note: Fp, publicData: PublicData): Uint256 {
    const concatenated = Buffer.concat([
      note.toBytes32().toBuffer(),
      publicData.to.toAddress().toBuffer(),
      publicData.eth.toBytes32().toBuffer(),
      publicData.tokenAddr.toAddress().toBuffer(),
      publicData.erc20Amount.toBytes32().toBuffer(),
      publicData.nft.toBytes32().toBuffer(),
      publicData.fee.toBytes32().toBuffer(),
    ])
    const result = ethers.utils.keccak256(concatenated)
    //  uint256 note = uint256(keccak256(abi.encodePacked(owner, eth, token, amount, nft, fee)));
    if (result === null) throw Error('hash result is null')
    return Bytes32.from(result).toUint()
  }

  static from(note: Note, to: BigNumberish, fee: BigNumberish): Withdrawal {
    return new Withdrawal(note.owner, note.salt, note.asset, {
      to: Fp.from(to),
      fee: Fp.from(fee),
    })
  }
}
