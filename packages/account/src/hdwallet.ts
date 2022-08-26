import {
  generateMnemonic,
  mnemonicToSeedSync,
  validateMnemonic,
  mnemonicToEntropy,
  entropyToMnemonic,
} from 'bip39'
import crypto from 'crypto'
import HDNode from 'hdkey'
import { Fp } from '@zkopru/babyjubjub'
import { Provider } from '@ethersproject/providers'
import { DB, EncryptedWallet, Keystore } from '@zkopru/database'
import { decryptKeystore } from '@ethersproject/json-wallets'
import { Wallet } from 'ethers'
import { ZkAccount } from './account'

export const PATH = (index: number) => `m/44'/60'/0'/0/${index}`
export class HDWallet {
  provider: Provider

  db: DB

  id?: string

  private password!: string

  private mnemonic!: string

  private seed!: Buffer

  constructor(provider: Provider, db: DB) {
    this.db = db
    this.provider = provider
  }

  static newMnemonic(strength?: number, list?: string[]): string {
    return generateMnemonic(strength, undefined, list)
  }

  async init(mnemonic: string, password: string) {
    if (this.mnemonic) throw Error('Already initialized')
    this.password = password
    this.mnemonic = mnemonic
    this.seed = mnemonicToSeedSync(this.mnemonic)
    await this.save(password)
  }

  async import(mnemonic: string, password: string) {
    if (this.mnemonic) throw Error('Already initialized')
    if (!validateMnemonic(mnemonic)) throw Error('Invalid mnemonic')
    this.password = password
    this.mnemonic = mnemonic
    this.seed = mnemonicToSeedSync(this.mnemonic)
    const { id } = await this.save(password)
    this.id = id
  }

  async list(): Promise<EncryptedWallet[]> {
    return this.db.findMany('EncryptedWallet', { where: {} })
  }

  async load(wallet: EncryptedWallet, password: string) {
    const { id, algorithm, iv, ciphertext, keylen, kdf, N, r, p, salt } = wallet
    const kdfParams = { N, r, p }
    let key: Buffer
    switch (kdf) {
      default:
        key = crypto.scryptSync(
          password,
          Buffer.from(salt, 'hex'),
          keylen,
          kdfParams,
        )
        break
    }
    const decipher = crypto.createDecipheriv(
      algorithm,
      key,
      Buffer.from(iv, 'hex'),
    )
    const entropy =
      decipher.update(Buffer.from(ciphertext, 'hex')) + decipher.final('binary')
    const retrievedMnemonic = entropyToMnemonic(entropy)
    if (!validateMnemonic(retrievedMnemonic)) {
      throw Error('Invalid password')
    }
    if (id) this.id = id
    this.password = password
    this.mnemonic = retrievedMnemonic
    this.seed = mnemonicToSeedSync(this.mnemonic)
    if (!(await this.list()).map(obj => obj.id).includes(id)) {
      await this.save(password)
    }
  }

  async retrieveAccounts(provider?: Provider): Promise<ZkAccount[]> {
    if (!this.seed) throw Error('Not initialized')
    const keys: Keystore[] = await this.db.findMany('Keystore', { where: {} })
    const accounts: ZkAccount[] = []
    for (let i = 0; i < keys.length; i += 1) {
      const keystoreAccount = await decryptKeystore(
        keys[i].encrypted,
        this.password,
      )
      accounts.push(ZkAccount.fromEthAccount(keystoreAccount, provider))
    }
    return accounts
  }

  async createAccount(deriveIndex: number): Promise<ZkAccount> {
    if (!this.seed || !this.password) throw Error('Not initialized')
    const masterNode = HDNode.fromMasterSeed(this.seed)
    const derivedKey = masterNode.derive(PATH(deriveIndex))
    const { privateKey } = derivedKey
    try {
      Fp.fromBuffer(privateKey)
    } catch (err) {
      throw Error('Jubjub does not support the derived key. Use another index')
    }
    const ethAccount = new Wallet(
      typeof privateKey === 'string' ? privateKey : privateKey.toString('hex'),
      this.provider,
    )
    const account = ZkAccount.fromEthAccount(ethAccount, this.provider)
    await this.db.create('Keystore', await account.toKeystoreSqlObj(this.password))
    return account
  }

  export(password: string): EncryptedWallet {
    if (!this.mnemonic) throw Error('Not initialized')
    const entropy: string = mnemonicToEntropy(this.mnemonic)
    const algorithm = 'aes-256-cbc'
    const salt = crypto.randomBytes(32)
    const iv = crypto.randomBytes(16)
    const kdf = 'scrypt'
    const keylen = 32
    const kdfParams = {
      N: 16384, // cost
      r: 8, // block size
      p: 1, // parallelization
    }
    const key = crypto.scryptSync(password, salt, keylen, kdfParams)
    const cipher = crypto.createCipheriv(algorithm, key, iv)
    const ciphertext =
      cipher.update(entropy, 'binary', 'hex') + cipher.final('hex')
    const hdwallet: EncryptedWallet = {
      ciphertext,
      iv: iv.toString('hex'),
      algorithm,
      keylen,
      kdf,
      N: kdfParams.N,
      r: kdfParams.r,
      p: kdfParams.p,
      salt: salt.toString('hex'),
    } as EncryptedWallet
    return hdwallet
  }

  async save(password: string): Promise<{ id: string }> {
    const hdwallet = this.export(password)
    if (!this.id) {
      await this.db.create('EncryptedWallet', hdwallet)
    } else {
      await this.db.update('EncryptedWallet', {
        where: {
          id: this.id,
        },
        update: hdwallet,
      })
    }
    return { id: hdwallet.id }
  }
}
