import Web3 from 'web3'
import { Account, EncryptedKeystoreV3Json } from 'web3-core'
import {
  Fr,
  Fp,
  Point,
  EdDSA,
  signEdDSA,
  verifyEdDSA,
} from '@zkopru/babyjubjub'
import { Keystore } from '@zkopru/database'
import createKeccak from 'keccak'
import assert from 'assert'
import { ZkViewer } from './viewer'
import { Wallet } from 'ethers'
import { BytesLike, hexlify } from 'ethers/lib/utils'

export class ZkAccount extends ZkViewer {
  private privateKey: string // ECDSA private key

  ethAddress: string

  ethAccount: Wallet

  constructor(_privateKey: BytesLike) {
    const privateKey = hexlify(_privateKey)

    const ethAccount = new Wallet(_privateKey)

    const A = Point.fromPrivKey(privateKey)
    // https://github.com/zkopru-network/zkopru/issues/34#issuecomment-666988505
    // Note: viewing key can be derived using another method. This is just for the convenience
    // to make it easy to restore spending key & viewing key together from a mnemonic source in
    // a deterministic way
    const v = Fr.from(
      createKeccak('keccak256')
        .update(privateKey)
        .digest(),
    )
    super(A, v)
    this.privateKey = privateKey
    this.ethAddress = ethAccount.address
    this.ethAccount = ethAccount
  }

  static fromEthAccount(account: Account): ZkAccount {
    return new ZkAccount(account.privateKey)
  }

  toKeystoreSqlObj(password: string): Keystore {
    return {
      zkAddress: this.zkAddress.toString(),
      address: this.ethAddress,
      encrypted: JSON.stringify(this.ethAccount.encrypt(password)),
    }
  }

  signEdDSA(msg: Fp): EdDSA {
    const signature = signEdDSA({ msg, privKey: this.privateKey })
    assert(verifyEdDSA(msg, signature, this.getEdDSAPubKey()))
    return signature
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
