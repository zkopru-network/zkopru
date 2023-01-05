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
import { BytesLike, hexlify } from 'ethers/lib/utils'
import { Provider } from '@ethersproject/providers'
import { ZkViewer } from './viewer'
import { getL2PrivateKeyBySignature } from '@zkopru/utils'

export class ZkAccount extends ZkViewer {
  private l2PrivateKey: string // EdDSA private key

  ethAddress: string

  ethAccount?: Wallet

  constructor(
    _l2PrivateKey: BytesLike,
    _l1Address: string,
    _l1Wallet?: Wallet,
  ) {
    const l2PrivateKey = hexlify(
      _l2PrivateKey.toString().startsWith('0x')
        ? _l2PrivateKey
        : '0x' + _l2PrivateKey.toString(),
    )

    const A = Point.fromPrivKey(l2PrivateKey)
    // https://github.com/zkopru-network/zkopru/issues/34#issuecomment-666988505
    // Note: viewing key can be derived using another method. This is just for the convenience
    // to make it easy to restore spending key & viewing key together from a mnemonic source in
    // a deterministic way
    const v = Fr.from(
      createKeccak('keccak256')
        .update(l2PrivateKey)
        .digest(),
    )
    super(A, v)
    this.l2PrivateKey = l2PrivateKey
    this.ethAccount = _l1Wallet
    this.ethAddress = _l1Wallet ? _l1Wallet.address : _l1Address
  }

  static async fromEthAccount(_l1Wallet: Wallet): Promise<ZkAccount> {
    const l2PrivateKey = await getL2PrivateKeyBySignature(_l1Wallet)
    return new ZkAccount(l2PrivateKey, _l1Wallet.address, _l1Wallet)
  }

  async toKeystoreSqlObj(password: string): Promise<Keystore> {
    return {
      zkAddress: this.zkAddress.toString(),
      address: this.ethAddress!,
      encrypted: await this.ethAccount!.encrypt(password),
    }
  }

  signEdDSA(msg: Fp): EdDSA {
    const signature = signEdDSA({ msg, privKey: this.l2PrivateKey })
    assert(verifyEdDSA(msg, signature, this.getEdDSAPubKey()))
    return signature
  }

  static async fromEncryptedKeystoreV3Json(
    encryptedKeystoreV3Json: string,
    password: string,
    provider: Provider,
  ): Promise<ZkAccount> {
    const account = Wallet.fromEncryptedJsonSync(
      encryptedKeystoreV3Json,
      password,
    ).connect(provider)
    const l2PrivateKey = await getL2PrivateKeyBySignature(account)
    return new ZkAccount(l2PrivateKey, account.address, account)
  }
}
