import { Utxo, Note, UtxoStatus, Sum } from '@zkopru/transaction'
import { Field, F, Point } from '@zkopru/babyjubjub'
import { schema, UtxoSql } from '@zkopru/database'
import { InanoSQLInstance } from '@nano-sql/core'
import { HDWallet, ZkAccount } from '@zkopru/account'
import { ZkOPRUNode, L1Contract } from '@zkopru/core'
import { logger } from '@zkopru/utils'

export interface Balance {
  eth: string

  erc20: { [addr: string]: string }

  erc721: { [addr: string]: string }
}

export class ZkWallet {
  zkopruId: string

  db: InanoSQLInstance

  wallet: HDWallet

  account: ZkAccount

  node: ZkOPRUNode

  accounts: ZkAccount[]

  erc20: string[]

  erc721: string[]

  cached: {
    layer1: {
      balance?: Balance
      nfts?: string[]
    }
  }

  constructor({
    zkopruId,
    db,
    wallet,
    account,
    node,
    accounts,
    erc20,
    erc721,
  }: {
    zkopruId: string
    db: InanoSQLInstance
    wallet: HDWallet
    account: ZkAccount
    node: ZkOPRUNode
    accounts: ZkAccount[]
    erc20: string[]
    erc721: string[]
  }) {
    this.zkopruId = zkopruId
    this.db = db
    this.wallet = wallet
    this.node = node
    this.accounts = accounts
    this.account = account
    this.erc20 = erc20
    this.erc721 = erc721
    this.cached = {
      layer1: {},
    }
  }

  setAccount(account: number | ZkAccount) {
    if (typeof account === 'number') {
      this.account = this.accounts[account]
    } else {
      this.account = account
    }
  }

  async getSpendableUtxos(account: ZkAccount): Promise<Utxo[]> {
    const utxoSqls: UtxoSql[] = (await this.db
      .selectTable(schema.utxo.name)
      .presetQuery('getSpendables', {
        zkopru: this.zkopruId,
        pubKeys: [account.pubKey.toHex()],
      })
      .exec()) as UtxoSql[]
    const utxos: Utxo[] = []
    utxoSqls.forEach(obj => {
      if (!obj.eth) throw Error('should have Ether data')
      if (!obj.pubKey) throw Error('should have pubkey data')
      if (!(account.pubKey.toHex() === obj.pubKey))
        throw Error('should have same pubkey')
      if (!obj.salt) throw Error('should have salt data')
      if (!(obj.status === UtxoStatus.NON_INCLUDED || obj.status === undefined))
        throw Error('should have undefined status or NON_INCLUDED status')

      let note!: Note
      if (!obj.tokenAddr) {
        note = Note.newEtherNote({
          eth: obj.eth,
          pubKey: account.pubKey,
          salt: obj.salt,
        })
      } else if (obj.erc20Amount) {
        note = Note.newERC20Note({
          eth: obj.eth,
          pubKey: account.pubKey,
          salt: obj.salt,
          tokenAddr: obj.tokenAddr,
          erc20Amount: obj.erc20Amount,
        })
      } else if (obj.nft) {
        note = Note.newNFTNote({
          eth: obj.eth,
          pubKey: account.pubKey,
          salt: obj.salt,
          tokenAddr: obj.tokenAddr,
          nft: obj.nft,
        })
      } else {
        throw Error('Not enough data to recover utxo')
      }
      utxos.push(Utxo.from(note))
    })
    return utxos
  }

  async getSpendables(account: ZkAccount): Promise<Sum> {
    const utxos: Utxo[] = await this.getSpendableUtxos(account)
    const assets = Sum.from(utxos)
    return assets
  }

  async getLayer1Assets(
    account: ZkAccount,
    erc20Addrs?: string[],
    erc721Addrs?: string[],
  ): Promise<Balance> {
    const balance: Balance = {
      eth: '0',
      erc20: {},
      erc721: {},
    }
    const promises: (() => Promise<void>)[] = []
    const { web3 } = this.node.l1Contract
    promises.push(async () => {
      balance.eth = await web3.eth.getBalance(account.address)
    })
    if (erc20Addrs) {
      promises.push(
        ...erc20Addrs.map(addr => async () => {
          balance.erc20[addr] = await L1Contract.asIERC20(web3, addr)
            .methods.balanceOf(account.address)
            .call()
        }),
      )
    }
    if (erc721Addrs) {
      promises.push(
        ...erc721Addrs.map(addr => async () => {
          balance.erc721[addr] = await L1Contract.asIERC721(web3, addr)
            .methods.balanceOf(account.address)
            .call()
        }),
      )
    }
    await Promise.all(promises.map(task => task()))
    this.cached.layer1.balance = balance
    return balance
  }

  async listLayer1Nfts(
    account: ZkAccount,
    erc721Addr: string,
    balance: number,
  ): Promise<string[]> {
    const promises: (() => Promise<void>)[] = []
    const nfts: string[] = []
    const { web3 } = this.node.l1Contract
    // 0x4f6ccce7 = tokenOfOwnerByIndex func sig
    const supportEnumeration = await L1Contract.asIERC721(web3, erc721Addr)
      .methods.supportsInterface('0x4f6ccce7')
      .call()
    if (supportEnumeration) {
      promises.push(
        ...Array(balance)
          .fill(0)
          .map((_, i) => async () => {
            nfts[i] = await L1Contract.asIERC721Enumerable(web3, erc721Addr)
              .methods.tokenOfOwnerByIndex(account.address, i)
              .call()
          }),
      )
      await Promise.all(promises.map(task => task()))
      return nfts
    }
    logger.error('It does not support tokenOfOwnerByIndex() interface')
    return []
  }

  async depositEther(eth: F, fee: F, to?: Point) {
    if (!this.cached.layer1.balance) {
      logger.error('fetch balance first')
      return
    }
    if (
      Field.strictFrom(this.cached.layer1.balance.eth).lt(
        Field.strictFrom(eth).add(Field.strictFrom(fee)),
      )
    ) {
      logger.error('Not enough Ether')
      return
    }
    const note = Note.newEtherNote({
      eth,
      pubKey: to || this.account.pubKey,
    })
    await this.deposit(note, Field.strictFrom(fee))
  }

  async depositERC20(eth: F, addr: string, amount: F, fee: F, to?: Point) {
    if (!this.cached.layer1.balance) {
      logger.error('fetch balance first')
      return
    }
    if (
      Field.strictFrom(this.cached.layer1.balance.eth).lt(
        Field.strictFrom(eth).add(Field.strictFrom(fee)),
      )
    ) {
      logger.error('Not enough Ether')
      return
    }
    if (
      Field.strictFrom(this.cached.layer1.balance.erc20[addr]).lt(
        Field.strictFrom(amount),
      )
    ) {
      logger.error('Not enough ERC20 balance')
      return
    }
    const note = Note.newERC20Note({
      eth,
      pubKey: to || this.account.pubKey,
      tokenAddr: addr,
      erc20Amount: amount,
    })
    await this.deposit(note, Field.strictFrom(fee))
  }

  async depositERC721(eth: F, addr: string, nft: F, fee: F, to?: Point) {
    if (!this.cached.layer1.balance) {
      logger.error('fetch balance first')
      return
    }
    if (
      Field.strictFrom(this.cached.layer1.balance.eth).lt(
        Field.strictFrom(eth).add(Field.strictFrom(fee)),
      )
    ) {
      logger.error('Not enough Ether')
      return
    }
    const note = Note.newNFTNote({
      eth,
      pubKey: to || this.account.pubKey,
      tokenAddr: addr,
      nft,
    })
    await this.deposit(note, Field.strictFrom(fee))
  }

  private async deposit(note: Note, fee: Field) {
    await this.node.l1Contract.user.methods
      .deposit(
        note.eth.toString(),
        note.salt.toString(),
        note.tokenAddr.toHex(20),
        note.erc20Amount.toString(),
        note.nft.toString(),
        [note.pubKey.x.toString(), note.pubKey.y.toString()],
        fee.toString(),
      )
      .send({ from: this.account.address })
  }
}
