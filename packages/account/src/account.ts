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
import { Wallet } from 'ethers'
import { ExternallyOwnedAccount } from '@ethersproject/abstract-signer'
import { BytesLike, hexlify } from 'ethers/lib/utils'
import { Provider } from '@ethersproject/providers'
import { ZkViewer } from './viewer'

export class ZkAccount extends ZkViewer {
  private privateKey: string // ECDSA private key

  ethAddress: string

  ethAccount: Wallet

  constructor(_privateKey: BytesLike, _provider?: Provider) {
    const privateKey = hexlify(_privateKey)

    const ethAccount = new Wallet(_privateKey, _provider)

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

  static fromEthAccount(
    account: ExternallyOwnedAccount,
    provider?: Provider,
  ): ZkAccount {
    return new ZkAccount(account.privateKey, provider)
  }

  async toKeystoreSqlObj(password: string): Promise<Keystore> {
    return {
      zkAddress: this.zkAddress.toString(),
      address: this.ethAddress,
      encrypted: await this.ethAccount.encrypt(password),
    }
  }

  signEdDSA(msg: Fp): EdDSA {
    const signature = signEdDSA({ msg, privKey: this.privateKey })
    assert(verifyEdDSA(msg, signature, this.getEdDSAPubKey()))
    return signature
  }

  static fromEncryptedKeystoreV3Json(
    encryptedKeystoreV3Json: string,
    password: string,
    provider?: Provider,
  ): ZkAccount {
    const account = Wallet.fromEncryptedJsonSync(
      encryptedKeystoreV3Json,
      password,
    )
    return new ZkAccount(account.privateKey, provider)
  }
}
