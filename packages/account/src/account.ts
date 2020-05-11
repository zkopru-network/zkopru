import Web3 from 'web3'
// import { Accounts } from 'web3-eth-accounts'
import { Account, EncryptedKeystoreV3Json, AddAccount } from 'web3-core'
import { Field, Point, EdDSA, signEdDSA } from '@zkopru/babyjubjub'
import { KeystoreSql } from '@zkopru/database'

export class ZkAccount {
  private privateKey: Field

  address: string

  pubKey: Point

  ethAccount: Account

  constructor(privateKey: Buffer | string) {
    if (!Field.inRange(privateKey)) {
      throw Error(
        'The private key exceeds the babyjubjub range. Use 254 bit key',
      )
    }
    if (privateKey instanceof Buffer) {
      this.privateKey = Field.fromBuffer(privateKey)
    } else {
      this.privateKey = Field.from(privateKey)
    }
    // TODO web3.js typescript has a problem. Update later when the bug is resolved.
    const web3 = new Web3()
    this.ethAccount = web3.eth.accounts.privateKeyToAccount(
      this.privateKey.toHex(32),
    )
    this.pubKey = Point.fromPrivKey(privateKey)
    this.address = this.ethAccount.address
  }

  toKeystoreSqlObj(password: string): KeystoreSql {
    return {
      pubKey: this.pubKey.encode().toString(),
      address: this.address,
      encrypted: this.ethAccount.encrypt(password),
    }
  }

  signEdDSA(msg: Field): EdDSA {
    return signEdDSA({ msg, privKey: this.privateKey.toBuffer('be') })
  }

  toAddAccount(): AddAccount {
    return {
      address: this.address,
      privateKey: this.privateKey.toHex(32),
    }
  }

  static fromEncryptedKeystoreV3Json(
    obj: EncryptedKeystoreV3Json,
    password: string,
  ): ZkAccount {
    const web3 = new Web3()
    const account = web3.eth.accounts.decrypt(obj, password)
    const privateKey = Field.from(account.privateKey).toBuffer('be')
    return new ZkAccount(privateKey)
  }
}
