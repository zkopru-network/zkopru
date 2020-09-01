import {
  UtxoStatus,
  Sum,
  RawTx,
  Utxo,
  WithdrawalStatus,
  Withdrawal,
  Outflow,
  ZkAddress,
} from '@zkopru/transaction'
import { Field, F } from '@zkopru/babyjubjub'
import { Layer1, TransactionObject, Tx } from '@zkopru/contracts'
import { HDWallet, ZkAccount } from '@zkopru/account'
import { ZkOPRUNode } from '@zkopru/core'
import { DB, Withdrawal as WithdrawalSql } from '@zkopru/prisma'
import { logger } from '@zkopru/utils'
import { soliditySha3 } from 'web3-utils'
import { Bytes32, Address, Uint256 } from 'soltypes'
import fetch, { Response } from 'node-fetch'
import assert from 'assert'
import { TransactionReceipt, Account } from 'web3-core'
import { ZkWizard } from './zk-wizard'

export interface Balance {
  eth: string

  erc20: { [addr: string]: string }

  erc721: { [addr: string]: string }
}

export class ZkWallet {
  db: DB

  private wallet: HDWallet

  node: ZkOPRUNode

  coordinator: string

  account?: ZkAccount

  wizard: ZkWizard

  accounts: ZkAccount[]

  erc20: Address[]

  erc721: Address[]

  cached: {
    layer1: {
      balance?: Balance
      nfts?: Uint256[]
    }
  }

  constructor({
    db,
    wallet,
    account,
    node,
    accounts,
    erc20,
    erc721,
    coordinator,
    snarkKeyPath,
  }: {
    db: DB
    wallet: HDWallet
    account?: ZkAccount
    node: ZkOPRUNode
    accounts: ZkAccount[]
    erc20: Address[]
    erc721: Address[]
    coordinator: string
    snarkKeyPath: string
  }) {
    this.db = db
    this.wallet = wallet
    this.node = node
    this.accounts = accounts
    this.erc20 = erc20
    this.erc721 = erc721
    this.coordinator = coordinator
    this.cached = {
      layer1: {},
    }
    if (account) this.setAccount(account)
    this.wizard = new ZkWizard({
      grove: this.node.l2Chain.grove,
      path: snarkKeyPath,
    })
  }

  setAccount(account: number | ZkAccount) {
    if (typeof account === 'number') {
      this.account = this.accounts[account]
    } else {
      this.account = account
    }
  }

  addERC20(...addresses: string[]) {
    this.erc20.push(
      ...addresses
        .filter(addr => this.erc20.find(Address.from(addr).eq) === undefined)
        .map(Address.from),
    )
  }

  removeERC20(address: string) {
    this.erc20 = this.erc20.filter(addr => !addr.eq(Address.from(address)))
  }

  addERC721(...addresses: string[]) {
    this.erc721.push(...addresses.map(Address.from))
  }

  removeERC721(address: string) {
    this.erc721 = this.erc721.filter(addr => !addr.eq(Address.from(address)))
  }

  async retrieveAccounts(): Promise<ZkAccount[]> {
    const accounts = await this.wallet.retrieveAccounts()
    this.accounts = accounts
    this.node.addAccounts(...accounts)
    return accounts
  }

  async createAccount(idx: number) {
    const newAccount = await this.wallet.createAccount(idx)
    this.node.addAccounts(newAccount)
    return newAccount
  }

  async getSpendableAmount(account: ZkAccount): Promise<Sum> {
    const notes: Utxo[] = await this.getSpendables(account)
    const assets = Sum.from(notes)
    return assets
  }

  async getLockedAmount(account: ZkAccount): Promise<Sum> {
    const notes: Utxo[] = await this.getUtxos(account, UtxoStatus.SPENDING)
    const assets = Sum.from(notes)
    return assets
  }

  async getSpendables(account: ZkAccount): Promise<Utxo[]> {
    const utxos = this.getUtxos(account, UtxoStatus.UNSPENT)
    return utxos
  }

  async getWithdrawables(
    account: ZkAccount,
    status: WithdrawalStatus,
  ): Promise<WithdrawalSql[]> {
    const withdrawals = await this.db.read(prisma =>
      prisma.withdrawal.findMany({
        where: {
          AND: [{ to: account.ethAddress }, { status }],
        },
      }),
    )
    return withdrawals
  }

  async getUtxos(account: ZkAccount, status: UtxoStatus): Promise<Utxo[]> {
    const noteSqls = await this.db.read(prisma =>
      prisma.utxo.findMany({
        where: {
          AND: [
            { owner: { in: [account.zkAddress.toString()] } },
            { status },
            { usedAt: null },
          ],
        },
      }),
    )
    const notes: Utxo[] = []
    noteSqls.forEach(obj => {
      if (!obj.eth) throw Error('should have Ether data')
      if (!obj.owner) throw Error('should have pubkey data')
      if (!(account.zkAddress.toString() === obj.owner))
        throw Error('should have same pubkey')
      if (!obj.salt) throw Error('should have salt data')

      let note!: Utxo
      if (!obj.tokenAddr) {
        note = Utxo.newEtherNote({
          eth: obj.eth,
          owner: account.zkAddress,
          salt: obj.salt,
        })
      } else if (obj.erc20Amount) {
        note = Utxo.newERC20Note({
          eth: obj.eth,
          owner: account.zkAddress,
          salt: obj.salt,
          tokenAddr: obj.tokenAddr,
          erc20Amount: obj.erc20Amount,
        })
      } else if (obj.nft) {
        note = Utxo.newNFTNote({
          eth: obj.eth,
          owner: account.zkAddress,
          salt: obj.salt,
          tokenAddr: obj.tokenAddr,
          nft: obj.nft,
        })
      } else {
        throw Error('Not enough data to recover utxo')
      }
      notes.push(note)
    })
    return notes
  }

  async fetchLayer1Assets(account: ZkAccount): Promise<Balance> {
    const balance: Balance = {
      eth: '0',
      erc20: {},
      erc721: {},
    }
    const promises: (() => Promise<void>)[] = []
    const { web3 } = this.node.l1Contract
    promises.push(async () => {
      balance.eth = await web3.eth.getBalance(account.ethAddress)
    })
    promises.push(
      ...this.erc20.map(addr => async () => {
        const erc20 = Layer1.getERC20(web3, addr.toString())
        const bal = await erc20.methods.balanceOf(account.ethAddress).call()
        balance.erc20[addr.toString()] = bal
      }),
    )
    promises.push(
      ...this.erc721.map(addr => async () => {
        const erc721 = Layer1.getIERC721Enumerable(web3, addr.toString())
        const count = await erc721.methods.balanceOf(account.ethAddress).call()
        balance.erc721[addr.toString()] = count
      }),
    )
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
    const supportEnumeration = await Layer1.getIERC721Enumerable(
      web3,
      erc721Addr,
    )
      .methods.supportsInterface('0x4f6ccce7')
      .call()
    if (supportEnumeration) {
      promises.push(
        ...Array(balance)
          .fill(0)
          .map((_, i) => async () => {
            nfts[i] = await Layer1.getIERC721Enumerable(web3, erc721Addr)
              .methods.tokenOfOwnerByIndex(account.ethAddress, i)
              .call()
          }),
      )
      await Promise.all(promises.map(task => task()))
      return nfts
    }
    logger.error('It does not support tokenOfOwnerByIndex() interface')
    return []
  }

  async depositEther(eth: F, fee: F, to?: ZkAddress): Promise<boolean> {
    if (!this.account) {
      logger.error('Account is not set')
      return false
    }
    await this.fetchLayer1Assets(this.account)
    if (!this.cached.layer1.balance) {
      logger.error('Failed to fetch balance')
      return false
    }
    if (
      Field.strictFrom(this.cached.layer1.balance.eth).lt(
        Field.strictFrom(eth).add(Field.strictFrom(fee)),
      )
    ) {
      logger.error('Not enough Ether')
      return false
    }
    const note = Utxo.newEtherNote({
      eth,
      owner: to || this.account.zkAddress,
    })
    const result = await this.deposit(note, Field.strictFrom(fee))
    return result
  }

  async depositERC20(
    eth: F,
    addr: string,
    amount: F,
    fee: F,
    to?: ZkAddress,
  ): Promise<boolean> {
    if (!this.account) {
      logger.error('Account is not set')
      return false
    }
    await this.fetchLayer1Assets(this.account)
    if (!this.cached.layer1.balance) {
      logger.error('Failed to fetch balance')
      return false
    }
    if (
      Field.strictFrom(this.cached.layer1.balance.eth).lt(
        Field.strictFrom(eth).add(Field.strictFrom(fee)),
      )
    ) {
      logger.error('Not enough Ether')
      return false
    }
    if (
      Field.strictFrom(this.cached.layer1.balance.erc20[addr]).lt(
        Field.strictFrom(amount),
      )
    ) {
      logger.error('Not enough ERC20 balance')
      return false
    }
    const note = Utxo.newERC20Note({
      eth,
      owner: to || this.account.zkAddress,
      tokenAddr: addr,
      erc20Amount: amount,
    })
    const result = await this.deposit(note, Field.strictFrom(fee))
    return result
  }

  async depositERC721(
    eth: F,
    addr: string,
    nft: F,
    fee: F,
    to?: ZkAddress,
  ): Promise<boolean> {
    if (!this.account) {
      logger.error('Account is not set')
      return false
    }
    await this.fetchLayer1Assets(this.account)
    if (!this.cached.layer1.balance) {
      logger.error('Failed to fetch balance')
      return false
    }
    if (
      Field.strictFrom(this.cached.layer1.balance.eth).lt(
        Field.strictFrom(eth).add(Field.strictFrom(fee)),
      )
    ) {
      logger.error('Not enough Ether')
      return false
    }
    const note = Utxo.newNFTNote({
      eth,
      owner: to || this.account.zkAddress,
      tokenAddr: addr,
      nft,
    })
    const result = await this.deposit(note, Field.strictFrom(fee))
    return result
  }

  async withdraw(withdrawal: WithdrawalSql): Promise<boolean> {
    if (!this.account) {
      logger.error('Account is not set')
      return false
    }
    if (!withdrawal.siblings) throw Error('No sibling data')
    if (!withdrawal.includedIn) throw Error('No block hash which includes it')
    if (!withdrawal.index) throw Error('No leaf index')
    const siblings: string[] = JSON.parse(withdrawal.siblings)
    const tx = this.node.l1Contract.user.methods.withdraw(
      withdrawal.hash,
      withdrawal.to,
      withdrawal.eth,
      withdrawal.tokenAddr,
      withdrawal.erc20Amount,
      withdrawal.nft,
      withdrawal.fee,
      withdrawal.includedIn,
      withdrawal.index,
      siblings,
    )
    const receipt = await this.node.l1Contract.sendTx(
      tx,
      this.account.ethAccount,
    )
    if (receipt) {
      await this.db.write(prisma =>
        prisma.withdrawal.update({
          where: { hash: withdrawal.hash },
          data: { status: WithdrawalStatus.WITHDRAWN },
        }),
      )
      return true
    }
    return false
  }

  async instantWithdrawal(
    prePayer: Address,
    withdrawal: WithdrawalSql,
  ): Promise<boolean> {
    if (!this.account) {
      logger.error('Account is not set')
      return false
    }
    if (!withdrawal.siblings) throw Error('No sibling data')
    if (!withdrawal.includedIn) throw Error('No block hash which includes it')
    if (!withdrawal.index) throw Error('No leaf index')
    const message = soliditySha3(
      prePayer.toString(),
      Bytes32.from(withdrawal.hash).toString(),
    )
    assert(message)
    const siblings: string[] = JSON.parse(withdrawal.siblings)
    const sign = this.account.ethAccount.sign(message)
    const data = {
      ...withdrawal,
      siblings,
      sign,
    }
    const response = await fetch(`${this.coordinator}/instant-withdraw`, {
      method: 'post',
      body: JSON.stringify(data),
    })
    if (response.ok) {
      await this.db.write(prisma =>
        prisma.withdrawal.update({
          where: { hash: withdrawal.hash },
          data: { status: WithdrawalStatus.TRANSFERRED },
        }),
      )
      return true
    }
    return false
  }

  async fetchPrice(): Promise<string> {
    const response = await fetch(`${this.coordinator}/price`)
    if (response.ok) {
      const { weiPerByte } = await response.json()
      if (weiPerByte) return weiPerByte
    }
    throw Error(`${response}`)
  }

  async sendLayer1Tx<T>({
    contract,
    tx,
    signer,
    option,
  }: {
    contract: Address | string
    tx: TransactionObject<T>
    signer?: Account
    option?: Tx
  }): Promise<TransactionReceipt | undefined> {
    const { web3 } = this.node.l1Contract
    const from = signer || this.account?.ethAccount
    if (!from) throw Error(`You need to set 'from' account`)
    const result = await Layer1.sendTx(
      tx,
      contract.toString(),
      web3,
      from,
      option,
    )
    return result
  }

  async sendTx(
    tx: RawTx,
    account?: ZkAccount,
    encryptTo?: ZkAddress,
  ): Promise<Response> {
    if (
      encryptTo &&
      tx.outflow.find(outflow => outflow.owner.eq(encryptTo)) === undefined
    ) {
      throw Error('Cannot find the recipient')
    }
    const from = account || this.account
    if (!from) throw Error('Account is not set')
    try {
      const zkTx = await this.wizard.shield({
        tx,
        account: from,
        encryptTo,
      })
      const { verifier } = this.node
      const snarkValid = await verifier.snarkVerifier.verifyTx(zkTx)
      assert(snarkValid, 'generated snark proof is invalid')
      const response = await fetch(`${this.coordinator}/tx`, {
        method: 'post',
        body: zkTx.encode().toString('hex'),
      })
      // add newly created notes
      for (const outflow of tx.outflow) {
        await this.saveOutflow(outflow)
      }
      // mark used notes as spending
      await this.db.write(prisma =>
        prisma.utxo.updateMany({
          where: {
            hash: {
              in: tx.inflow.map(utxo =>
                utxo
                  .hash()
                  .toUint256()
                  .toString(),
              ),
            },
          },
          data: { status: UtxoStatus.SPENDING },
        }),
      )
      return response
    } catch (err) {
      logger.error(err)
      throw err
    }
  }

  private async deposit(note: Utxo, fee: Field): Promise<boolean> {
    if (!this.account) {
      logger.error('Account is not set')
      return false
    }
    const tx = this.node.l1Contract.user.methods.deposit(
      note.owner.spendingPubKey().toString(),
      note.salt.toUint256().toString(),
      note
        .eth()
        .toUint256()
        .toString(),
      note
        .tokenAddr()
        .toAddress()
        .toString(),
      note
        .erc20Amount()
        .toUint256()
        .toString(),
      note
        .nft()
        .toUint256()
        .toString(),
      fee.toUint256().toString(),
    )
    const receipt = await this.node.l1Contract.sendTx(
      tx,
      this.account.ethAccount,
      {
        value: note
          .eth()
          .add(fee)
          .toString(),
      },
    )
    // TODO check what web3 methods returns when it failes
    if (receipt) {
      await this.saveOutflow(note)
      return true
    }
    return false
  }

  private async saveOutflow(outflow: Outflow) {
    if (outflow instanceof Utxo) {
      await this.db.write(prisma =>
        prisma.utxo.create({
          data: {
            hash: outflow
              .hash()
              .toUint256()
              .toString(),
            owner: outflow.owner.toString(),
            salt: outflow.salt.toUint256().toString(),
            eth: outflow
              .eth()
              .toUint256()
              .toString(),
            tokenAddr: outflow
              .tokenAddr()
              .toAddress()
              .toString(),
            erc20Amount: outflow
              .erc20Amount()
              .toUint256()
              .toString(),
            nft: outflow
              .nft()
              .toUint256()
              .toString(),
            status: UtxoStatus.NON_INCLUDED,
          },
        }),
      )
    } else if (outflow instanceof Withdrawal) {
      await this.db.write(prisma =>
        prisma.withdrawal.create({
          data: {
            hash: outflow
              .hash()
              .toUint256()
              .toString(),
            withdrawalHash: outflow.withdrawalHash().toString(),
            owner: outflow.owner.toString(),
            salt: outflow.salt.toUint256().toString(),
            eth: outflow
              .eth()
              .toUint256()
              .toString(),
            tokenAddr: outflow
              .tokenAddr()
              .toAddress()
              .toString(),
            erc20Amount: outflow
              .erc20Amount()
              .toUint256()
              .toString(),
            nft: outflow
              .nft()
              .toUint256()
              .toString(),
            to: outflow.publicData.to.toAddress().toString(),
            fee: outflow.publicData.fee.toAddress().toString(),
            status: UtxoStatus.NON_INCLUDED,
          },
        }),
      )
    }
  }
}
