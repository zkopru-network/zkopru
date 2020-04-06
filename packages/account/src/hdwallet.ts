import { nanoSQL } from '@nano-sql/core'
import {
  generateMnemonic,
  mnemonicToSeedSync,
  validateMnemonic,
  mnemonicToEntropy,
  entropyToMnemonic,
} from 'bip39'
import crypto from 'crypto'
import HDNode from 'hdkey'
import { HDWalletSqlObj, KeystoreSqlObj, schema } from '@zkopru/database'
import { Point, Field } from '@zkopru/babyjubjub'
import { ZkAccount } from './account'

export const PATH = (index: number) => `m/44'/60'/0'/0/${index}`
export class HDWallet {
  db: nanoSQL

  id?: string

  private password!: string

  private mnemonic!: string

  private seed!: Buffer

  constructor(db: nanoSQL) {
    this.db = db
  }

  static newMnemonic(): string {
    return generateMnemonic()
  }

  async init(mnemonic: string, password: string) {
    if (this.mnemonic) throw Error('Already initialized')
    this.password = password
    this.mnemonic = mnemonic
    this.seed = mnemonicToSeedSync(this.mnemonic)
    await this.save(password)
    await this.createAccount(0)
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

  async list(): Promise<HDWalletSqlObj[]> {
    const rows = await this.db
      .selectTable(schema.hdWallet.name)
      .query('select')
      .exec()
    return rows as HDWalletSqlObj[]
  }

  async load(wallet: HDWalletSqlObj, password: string) {
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
        key = crypto.scryptSync(password, salt, keylen, kdfParams)
        break
    }
    const decipher = crypto.createDecipheriv(algorithm, key, iv)
    const entropy =
      decipher.update(ciphertext, 'hex', 'binary') + decipher.final('binary')
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
    const { seed } = this
    const keys: KeystoreSqlObj[] = await this.db
      .selectTable(schema.keystore.name)
      .query('select')
      .exec()
    const storedPubKeys = keys.map(key => key.pubKey)
    const candidates: Buffer[] = []
    for (let i = 0; i < keys.length; i += 1) {
      const masterNode = HDNode.fromMasterSeed(seed)
      const derivedKey = masterNode.derive(PATH(i))
      try {
        const derivedPubKey = Point.fromPrivKey(derivedKey.privateKey).toHex()
        if (storedPubKeys.includes(derivedPubKey)) {
          candidates.push(derivedKey.privateKey)
        }
      } catch (err) {
        // skip
      }
    }
    return candidates.map(key => new ZkAccount(key))
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
    const account = new ZkAccount(derivedKey.privateKey)
    await this.db
      .selectTable(schema.keystore.name)
      .presetQuery('addKey', account.toKeystoreSqlObj(this.password))
      .exec()
    return account
  }

  export(password: string): HDWalletSqlObj {
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
    const hdwallet: HDWalletSqlObj = {
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
      .selectTable(schema.keystore.name)
      .presetQuery('save', { id: this.id, ...hdwallet })
      .exec()
    return { id: result[0].id }
  }
}
