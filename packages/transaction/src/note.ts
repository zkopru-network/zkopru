import { poseidon } from 'circomlib'
import { Fp } from '@zkopru/babyjubjub'
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
  eth: Fp
  tokenAddr: Fp
  erc20Amount: Fp
  nft: Fp
}
export class Note {
  owner: ZkAddress

  salt: Fp

  asset: Asset

  outflowType: OutflowType

  constructor(owner: ZkAddress, salt: Fp, asset: Asset) {
    this.owner = owner
    this.salt = salt
    this.asset = asset
    this.outflowType = OutflowType.UTXO
  }

  hash(): Fp {
    const assetHash = this.assetHash()
    const noteHash = Fp.from(
      poseidon([
        this.owner.spendingPubKey().toBigInt(),
        this.salt.toBigInt(),
        assetHash.toBigInt(),
      ]).toString(),
    )
    return noteHash
  }

  assetHash(): Fp {
    return Fp.from(
      poseidon([
        this.asset.eth.toBigInt(),
        this.asset.tokenAddr.toBigInt(),
        this.asset.erc20Amount.toBigInt(),
        this.asset.nft.toBigInt(),
      ]).toString(),
    )
  }

  eth(): Fp {
    return this.asset.eth
  }

  tokenAddr(): Fp {
    return this.asset.tokenAddr
  }

  erc20Amount(): Fp {
    return this.asset.erc20Amount
  }

  nft(): Fp {
    return this.asset.nft
  }
}
