import Web3 from 'web3'
import { Account, EncryptedKeystoreV3Json, AddAccount } from 'web3-core'
import { Field, Point, EdDSA, signEdDSA, verifyEdDSA } from '@zkopru/babyjubjub'
import { Keystore } from '@zkopru/prisma'
import { hexify } from '@zkopru/utils'
import createKeccak from 'keccak'
import assert from 'assert'
import { ZkViewer } from './viewer'

export class ZkAccount extends ZkViewer {
  private p: Field // spending key

  private ethPK: string

  ethAddress: string

  ethAccount: Account

  constructor(pk: Buffer | string | Account) {
    let ethPK: string
    let p: Field
    let ethAccount: Account
    if (pk instanceof Buffer || typeof pk === 'string') {
      if (pk instanceof Buffer) {
        ethPK = hexify(pk, 32)
        p = Field.fromBuffer(pk)
      } else {
        ethPK = hexify(pk, 32)
        p = Field.from(pk)
      }
      const web3 = new Web3()
      ethAccount = web3.eth.accounts.privateKeyToAccount(ethPK)
    } else {
      ethPK = hexify(pk.privateKey, 32)
      p = Field.from(pk.privateKey)
      ethAccount = pk
    }
    const pG = Point.fromPrivKey(p.toHex(32))
    // https://github.com/zkopru-network/zkopru/issues/34#issuecomment-666988505
    // Note: viewing key can be derived using another method. This is just for the convenience
    // to make it easy to restore spending key & viewing key together from a mnemonic source in
    // a deterministic way
    const n = Field.from(
      createKeccak('keccak256')
        .update(p.toBytes32().toBuffer())
        .digest(),
    )
    super(pG, n)
    this.p = p
    this.ethPK = ethPK
    this.ethAddress = ethAccount.address
    this.ethAccount = ethAccount
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
    assert(verifyEdDSA(msg, signature, this.getEdDSAPoint()))
    return signature
  }

  toAddAccount(): AddAccount {
    return {
      address: this.ethAddress,
      privateKey: this.ethPK,
    }
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
