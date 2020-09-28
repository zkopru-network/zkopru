import { poseidon } from 'circomlib'
import { Field } from '@zkopru/babyjubjub'
import { ZkAddress } from './zk-address'

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

export type Asset = {
  eth: Field
  tokenAddr: Field
  erc20Amount: Field
  nft: Field
}
export class Note {
  owner: ZkAddress

  salt: Field

  asset: Asset

  outflowType: OutflowType

  constructor(owner: ZkAddress, salt: Field, asset: Asset) {
    this.owner = owner
    this.salt = salt
    this.asset = asset
    this.outflowType = OutflowType.UTXO
  }

  hash(): Field {
    const assetHash = this.assetHash()
    const noteHash = Field.from(
      poseidon([
        this.owner.spendingPubKey().toBigInt(),
        this.salt.toBigInt(),
        assetHash.toBigInt(),
      ]).toString(),
    )
    return noteHash
  }

  assetHash(): Field {
    return Field.from(
      poseidon([
        this.asset.eth.toBigInt(),
        this.asset.tokenAddr.toBigInt(),
        this.asset.erc20Amount.toBigInt(),
        this.asset.nft.toBigInt(),
      ]).toString(),
    )
  }

  eth(): Field {
    return this.asset.eth
  }

  tokenAddr(): Field {
    return this.asset.tokenAddr
  }

  erc20Amount(): Field {
    return this.asset.erc20Amount
  }

  nft(): Field {
    return this.asset.nft
  }
}
