import Web3 from 'web3'
import * as circomlib from 'circomlib'
import { Account, EncryptedKeystoreV3Json, AddAccount } from 'web3-core'
import { Field, Point, EdDSA, signEdDSA, verifyEdDSA } from '@zkopru/babyjubjub'
import { Keystore } from '@zkopru/prisma'
import { ZkAddress, ZkTx, Utxo } from '@zkopru/transaction'
import { hexify } from '@zkopru/utils'
import createKeccak from 'keccak'
import assert from 'assert'
import { TokenRegistry } from '~transaction/tokens'

const poseidonHash = circomlib.poseidon.createHash(6, 8, 57)

export class ZkAccount {
  private p: Field // spending key

  private pG: Point // spending key's EdDSA point

  private n: Field // nullifier seed, viewing key

  private ethPK: string

  ethAddress: string

  ethAccount: Account

  zkAddress: ZkAddress // https://github.com/zkopru-network/zkopru/issues/43

  constructor(pk: Buffer | string | Account) {
    if (pk instanceof Buffer || typeof pk === 'string') {
      if (pk instanceof Buffer) {
        this.ethPK = hexify(pk, 32)
        this.p = Field.fromBuffer(pk)
      } else {
        this.ethPK = hexify(pk, 32)
        this.p = Field.from(pk)
      }
      const web3 = new Web3()
      this.ethAccount = web3.eth.accounts.privateKeyToAccount(this.ethPK)
    } else {
      this.ethPK = hexify(pk.privateKey, 32)
      this.p = Field.from(pk.privateKey)
      this.ethAccount = pk
    }
    this.pG = Point.fromPrivKey(this.p.toHex(32))
    this.ethAddress = this.ethAccount.address.toLowerCase()
    // https://github.com/zkopru-network/zkopru/issues/34#issuecomment-666988505
    // Note: viewing key can be derived using another method. This is just for the convenience
    // to make it easy to restore spending key & viewing key together from a mnemonic source in
    // a deterministic way
    this.n = Field.from(
      createKeccak('keccak256')
        .update(this.p.toBytes32().toBuffer())
        .digest(),
    )
    const N = Point.fromPrivKey(this.n.toHex(32))
    const P = Field.from(
      poseidonHash([
        this.pG.x.toIden3BigInt(),
        this.pG.y.toIden3BigInt(),
        this.n.toIden3BigInt(),
      ]).toString(),
    )
    this.zkAddress = ZkAddress.from(P, N)
  }

  toKeystoreSqlObj(password: string): Keystore {
    return {
      zkAddress: this.zkAddress.toString(),
      address: this.ethAddress,
      encrypted: JSON.stringify(this.ethAccount.encrypt(password)),
    }
  }

  signEdDSA(msg: Field): EdDSA {
    const signature = signEdDSA({ msg, privKey: this.p.toHex(32) })
    assert(verifyEdDSA(msg, signature, this.pG))
    return signature
  }

  getEdDSAPoint(): Point {
    return this.pG
  }

  toAddAccount(): AddAccount {
    return {
      address: this.ethAddress,
      privateKey: this.ethPK,
    }
  }

  decrypt(zkTx: ZkTx, tokenRegistry?: TokenRegistry): Utxo | undefined {
    const { memo } = zkTx
    if (!memo) {
      return
    }
    let note: Utxo | undefined
    for (const outflow of zkTx.outflow) {
      try {
        note = Utxo.decrypt({
          utxoHash: outflow.note,
          memo,
          spendingPubKey: this.zkAddress.spendingPubKey(),
          viewingKey: this.n,
          tokenRegistry,
        })
      } catch (err) {
        console.error(err)
      }
      if (note) break
    }
    return note ? Utxo.from(note) : undefined
  }

  getNullifierSeed(): Field {
    return this.n
  }

  static fromEncryptedKeystoreV3Json(
    obj: EncryptedKeystoreV3Json,
    password: string,
  ): ZkAccount {
    const web3 = new Web3()
    const account = web3.eth.accounts.decrypt(obj, password)
    return new ZkAccount(account.privateKey)
  }
}
