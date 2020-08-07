import * as circomlib from 'circomlib'
import { Field } from '@zkopru/babyjubjub'
import { ZkAddress } from './zk-address'

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
    const assetHash = Field.from(
      poseidonHash([
        this.asset.eth.toIden3BigInt(),
        this.asset.tokenAddr.toIden3BigInt(),
        this.asset.erc20Amount.toIden3BigInt(),
        this.asset.nft.toIden3BigInt(),
      ]).toString(),
    )
    const noteHash = Field.from(
      poseidonHash([
        this.owner.spendingPubKey().toIden3BigInt(),
        this.salt.toIden3BigInt(),
        assetHash.toIden3BigInt(),
      ]).toString(),
    )
    return noteHash
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
