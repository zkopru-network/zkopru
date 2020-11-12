import { ZkAccount, ZkViewer } from '@zkopru/account'
import { DB } from '@zkopru/prisma'
import { Address } from 'soltypes'

export class Tracker {
  db: DB

  withdrawalTrackers: Address[]

  transferTrackers: ZkViewer[]

  constructor(db: DB) {
    this.db = db
    this.withdrawalTrackers = [] // accounts to track withdrawal transactions
    this.transferTrackers = [] // accounts to track transfer transactions
  }

  async refresh() {
    const trackers = await this.db.read(prisma => prisma.tracker.findMany())
    const l2Accounts: ZkViewer[] = []
    const l1Accounts: Address[] = []
    for (const tracker of trackers) {
      if (tracker.viewer) {
        l2Accounts.push(ZkViewer.from(tracker.viewer))
      }
      if (tracker.address) {
        l1Accounts.push(Address.from(tracker.address))
      }
    }
    this.withdrawalTrackers = l1Accounts
    this.transferTrackers = l2Accounts
  }

  async addAccounts(...accounts: ZkAccount[]) {
    await this.addWithdrawalTracker(
      ...accounts.map(acc => Address.from(acc.ethAddress)),
    )
    await this.addUtxoTracker(...accounts)
  }

  async addWithdrawalTracker(...accounts: Address[]) {
    await this.db.write(async prisma => {
      const unregistered = accounts.filter(
        account => !this.withdrawalTrackers.find(a => a.eq(account)),
      )
      this.withdrawalTrackers.push(...unregistered)
      return prisma.$transaction(
        unregistered.map(account =>
          prisma.tracker.upsert({
            where: { address: account.toString() },
            create: { address: account.toString() },
            update: { address: account.toString() },
          }),
        ),
      )
    })
  }

  async addUtxoTracker(...accounts: ZkViewer[]) {
    await this.db.write(async prisma => {
      const unregistered = accounts.filter(
        account =>
          !this.transferTrackers.find(a => a.zkAddress.eq(account.zkAddress)),
      )
      this.transferTrackers.push(...unregistered)
      return prisma.$transaction(
        unregistered.map(account =>
          prisma.tracker.upsert({
            where: { viewer: account.encodeViewingKey() },
            create: { viewer: account.encodeViewingKey() },
            update: { viewer: account.encodeViewingKey() },
          }),
        ),
      )
    })
  }
}
