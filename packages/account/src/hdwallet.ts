import { InanoSQLInstance } from '@nano-sql/core'
import {
  generateMnemonic,
  mnemonicToSeedSync,
  validateMnemonic,
  mnemonicToEntropy,
  entropyToMnemonic,
} from 'bip39'
import crypto from 'crypto'
import HDNode from 'hdkey'
import Web3 from 'web3'
import { HDWalletSql, KeystoreSql, schema } from '@zkopru/database'
import { Field } from '@zkopru/babyjubjub'
import { hexify } from '@zkopru/utils'
import { ZkAccount } from './account'

export const PATH = (index: number) => `m/44'/60'/0'/0/${index}`
export class HDWallet {
  web3: Web3

  db: InanoSQLInstance

  id?: string

  private password!: string

  private mnemonic!: string

  private seed!: Buffer

  constructor(web3: Web3, db: InanoSQLInstance) {
    this.db = db
    this.web3 = web3
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

  async list(): Promise<HDWalletSql[]> {
    const rows = await this.db
      .selectTable(schema.hdWallet.name)
      .query('select')
      .exec()
    return rows as HDWalletSql[]
  }

  async load(wallet: HDWalletSql, password: string) {
    const {
      id,
      algorithm,
      iv,
      ciphertext,
      keylen,
      kdf,
      kdfParams,
      salt,
    } = wallet
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
  }

  async retrieveAccounts(): Promise<ZkAccount[]> {
    if (!this.seed) throw Error('Not initialized')
    const keys: KeystoreSql[] = (await this.db
      .selectTable(schema.keystore.name)
      .query('select')
      .exec()) as KeystoreSql[]
    const accounts: ZkAccount[] = []
    for (let i = 0; i < keys.length; i += 1) {
      const ethAccount = this.web3.eth.accounts.decrypt(
        keys[i].encrypted,
        this.password,
      )
      accounts.push(new ZkAccount(ethAccount))
    }
    return accounts
  }

  async createAccount(deriveIndex: number): Promise<ZkAccount> {
    if (!this.seed || !this.password) throw Error('Not initialized')
    const masterNode = HDNode.fromMasterSeed(this.seed)
    const derivedKey = masterNode.derive(PATH(deriveIndex))
    try {
      Field.fromBuffer(derivedKey.privateKey)
    } catch (err) {
      throw Error('Jubjub does not support the derived key. Use another index')
    }
    const ethAccount = this.web3.eth.accounts.privateKeyToAccount(
      hexify(derivedKey.privateKey, 32),
    )
    const account = new ZkAccount(ethAccount)
    await this.db
      .selectTable(schema.keystore.name)
      .presetQuery('addKey', {
        keystore: account.toKeystoreSqlObj(this.password),
      })
      .exec()
    return account
  }

  export(password: string): HDWalletSql {
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
    const hdwallet: HDWalletSql = {
      ciphertext,
      iv: iv.toString('hex'),
      algorithm,
      keylen,
      kdf,
      kdfParams,
      salt: salt.toString('hex'),
    }
    return hdwallet
  }

  async save(password: string): Promise<{ id: string }> {
    const hdwallet = this.export(password)
    const result = await this.db
      .selectTable(schema.hdWallet.name)
      .presetQuery('save', {
        hdWallet: {
          id: this.id,
          ...hdwallet,
        },
      })
      .exec()
    return { id: result[0].id }
  }
}
