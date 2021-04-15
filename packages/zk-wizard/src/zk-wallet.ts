import { HDWallet, ZkAccount } from '@zkopru/account'
import { ZkWalletAccount, ZkWalletAccountConfig } from './zk-wallet-account'
import { DB } from '@zkopru/database'

export class ZkWallet extends ZkWalletAccount {
  private wallet: HDWallet

  accounts: ZkAccount[]

  constructor(
    config: ZkWalletAccountConfig & {
      db?: DB,
      accounts: ZkAccount[]
      wallet: HDWallet
    },
  ) {
    super(config)
    if (config.db) {
      // optionally override the superclass
      this.db = config.db
    }
    this.accounts = config.accounts || []
    this.wallet = config.wallet
    this.node.tracker.addAccounts(...this.accounts)
    if (config.account) {
      this.setAccount(config.account)
    }
  }

  setAccount(account: number | ZkAccount) {
    if (typeof account === 'number') {
      this.account = this.accounts[account]
    } else {
      this.account = account
    }
  }

  async retrieveAccounts(): Promise<ZkAccount[]> {
    const accounts = await this.wallet.retrieveAccounts()
    this.accounts = accounts
    this.node.tracker.addAccounts(...accounts)
    return accounts
  }

  async createAccount(idx: number) {
    const newAccount = await this.wallet.createAccount(idx)
    this.node.tracker.addAccounts(newAccount)
    return newAccount
  }
}
