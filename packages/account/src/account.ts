import { Accounts } from 'web3-eth-accounts'
import { Account, EncryptedKeystoreV3Json } from 'web3-core'
import { Field, Point, EdDSA, signEdDSA } from '@zkopru/babyjubjub'
import { KeystoreSqlObj } from '@zkopru/database'

export class ZkAccount {
  private privateKey: Field

  address: string

  pubKey: Point

  ethAccount: Account

  constructor(privateKey: Buffer) {
    this.privateKey = Field.fromBuffer(privateKey)
    this.ethAccount = new Accounts().privateKeyToAccount(
      this.privateKey.toHex(),
    )
    this.pubKey = Point.fromPrivKey(privateKey)
    this.address = this.ethAccount.address
  }

  toKeystoreSqlObj(password: string): KeystoreSqlObj {
    return {
      pubKey: this.pubKey.encode().toString(),
      address: this.address,
      encrypted: this.ethAccount.encrypt(password),
    }
  }

  signEdDSA(msg: Field): EdDSA {
    return signEdDSA({ msg, privKey: this.privateKey.toBuffer() })
  }

  static fromEncryptedKeystoreV3Json(
    obj: EncryptedKeystoreV3Json,
    password: string,
  ): ZkAccount {
    const account = new Accounts().decrypt(obj, password)
    const privateKey = Field.from(account.privateKey).toBuffer()
    return new ZkAccount(privateKey)
  }
}
