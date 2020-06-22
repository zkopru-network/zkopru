import Web3 from 'web3'
// import { Accounts } from 'web3-eth-accounts'
import { Account, EncryptedKeystoreV3Json, AddAccount } from 'web3-core'
import { Field, Point, EdDSA, signEdDSA, verifyEdDSA } from '@zkopru/babyjubjub'
import { Keystore } from '@zkopru/prisma'
import { ZkTx, Utxo } from '@zkopru/transaction'
import { hexify } from '@zkopru/utils'
import assert from 'assert'

export class ZkAccount {
  private snarkPK: Field

  private ethPK: string

  address: string

  pubKey: Point

  ethAccount: Account

  constructor(pk: Buffer | string | Account) {
    if (pk instanceof Buffer || typeof pk === 'string') {
      if (pk instanceof Buffer) {
        this.ethPK = hexify(pk, 32)
        this.snarkPK = Field.fromBuffer(pk)
      } else {
        this.ethPK = hexify(pk, 32)
        this.snarkPK = Field.from(pk)
      }
      const web3 = new Web3()
      this.ethAccount = web3.eth.accounts.privateKeyToAccount(this.ethPK)
    } else {
      this.ethPK = hexify(pk.privateKey, 32)
      this.snarkPK = Field.from(pk.privateKey)
      this.ethAccount = pk
    }
    this.address = this.ethAccount.address.toLowerCase()
    this.pubKey = Point.fromPrivKey(this.snarkPK.toHex(32))
  }

  toKeystoreSqlObj(password: string): Keystore {
    return {
      pubKey: hexify(this.pubKey.encode()),
      address: this.address,
      encrypted: JSON.stringify(this.ethAccount.encrypt(password)),
    }
  }

  signEdDSA(msg: Field): EdDSA {
    const signature = signEdDSA({ msg, privKey: this.snarkPK.toHex(32) })
    assert(verifyEdDSA(msg, signature, this.pubKey))
    return signature
  }

  toAddAccount(): AddAccount {
    return {
      address: this.address,
      privateKey: this.ethPK,
    }
  }

  decrypt(zkTx: ZkTx): Utxo | undefined {
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
          privKey: this.snarkPK.toHex(32),
        })
      } catch (err) {
        console.error(err)
      }
      if (note) break
    }
    return note ? Utxo.from(note) : undefined
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
