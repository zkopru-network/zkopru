import { ZkAccount } from '@zkopru/account'
import { WebsocketProvider, IpcProvider } from 'web3-core'
import { DB } from '@zkopru/prisma'
import Web3 from 'web3'
import { L1Contract } from '../context/layer1'
import { Verifier, VerifyOption } from '../verifier'
import { L2Chain } from '../context/layer2'
import { BootstrapHelper } from './bootstrap'
import { Synchronizer } from './synchronizer'
import { ZkopruNode } from './zkopru-node'

type provider = WebsocketProvider | IpcProvider

export class FullNode extends ZkopruNode {
  constructor({
    db,
    l1Contract,
    l2Chain,
    verifier,
    synchronizer,
    bootstrapHelper,
    accounts,
    verifyOption,
  }: {
    db: DB
    l1Contract: L1Contract
    l2Chain: L2Chain
    verifier: Verifier
    bootstrapHelper?: BootstrapHelper
    synchronizer: Synchronizer
    accounts?: ZkAccount[]
    verifyOption: VerifyOption
  }) {
    super({
      db,
      l1Contract,
      l2Chain,
      verifier,
      synchronizer,
      bootstrapHelper,
      accounts,
      verifyOption,
    })
  }

  static async new({
    provider,
    address,
    db,
    accounts,
    option,
  }: {
    provider: provider
    address: string
    db: DB
    accounts?: ZkAccount[]
    option?: VerifyOption
  }): Promise<FullNode> {
    const verifyOption = option || {
      header: true,
      deposit: true,
      migration: true,
      outputRollUp: true,
      withdrawalRollUp: true,
      nullifierRollUp: true,
      snark: true,
    }
    if (!provider.connected) throw Error('provider is not connected')
    const web3: Web3 = new Web3(provider)
    // Add zk account to the web3 object if it exists
    if (accounts) {
      for (const account of accounts) {
        web3.eth.accounts.wallet.add(account.toAddAccount())
      }
    }
    const l1Contract = new L1Contract(web3, address)
    // retrieve l2 chain from database
    const networkId = await web3.eth.net.getId()
    const chainId = await web3.eth.getChainId()
    const l2Chain: L2Chain = await ZkopruNode.getOrInitChain(
      db,
      l1Contract,
      networkId,
      chainId,
      address,
      accounts,
    )
    let vks = {}
    if (verifyOption.snark) {
      vks = await l1Contract.getVKs()
    }
    const verifier = new Verifier(verifyOption, vks)
    // If the chain needs bootstraping, fetch bootstrap data and apply
    const synchronizer = new Synchronizer(db, l1Contract)
    return new FullNode({
      db,
      l1Contract,
      l2Chain,
      verifier,
      synchronizer,
      accounts,
      verifyOption,
    })
  }
}
