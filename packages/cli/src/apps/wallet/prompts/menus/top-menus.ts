import { ZkAccount } from '@zkopru/account'
import App, { AppMenu, Context } from '..'

export default class TopMenu extends App {
  static code = AppMenu.TOP_MENU

  // eslint-disable-next-line class-methods-use-this
  async run(context: Context): Promise<{ context: Context; next: number }> {
    const accounts: ZkAccount[] = await this.base.retrieveAccounts()
    const { idx } = await this.ask({
      type: 'select',
      name: 'idx',
      message: 'Which account do you want to use?',
      choices: [
        { title: `${accounts[0].ethAddress} - metamask`, value: 0 },
        ...accounts.map((obj, i) => ({
          title: `${obj.ethAddress} - keystore`,
          value: i + 10,
        })),
        {
          title: 'Create new account',
          value: -1,
        },
        {
          title: 'Quit',
          value: -2,
        },
      ],
    })
    let reRun: { context: Context; next: number }
    switch (idx) {
      case 0:
        const accountMetaMask = await this.getZkAccountBySignature()
        this.base.setAccount(accountMetaMask)
        return {
          context: { ...context, account: accountMetaMask },
          next: AppMenu.ACCOUNT_DETAIL,
        }
      case -1:
        await this.base.createAccount(accounts.length)
        reRun = await this.run(context)
        return reRun
      case -2:
        return { context, next: AppMenu.EXIT }
      default:
        this.base.setAccount(accounts[idx - 10])
        return {
          context: { ...context, account: accounts[idx - 10] },
          next: AppMenu.ACCOUNT_DETAIL,
        }
    }
  }

  async getZkAccountBySignature(): Promise<ZkAccount> {
    const chainId = (await this.base.node.layer1.provider.getNetwork()).chainId
    const domain = {
      chainId: chainId,
      name: 'Zkopru Testnet',
      version: '0',
    }
    const message = {
      info: 'Unlock Zkopru wallet',
      warning:
        'This signature is your private key, only sign on official Zkopru websites!',
    }
    const types = {
      ZkopruKey: [
        { name: 'info', type: 'string' },
        { name: 'warning', type: 'string' },
      ],
    }
    const signedData = await this.base.accounts[0].ethAccount._signTypedData(
      domain,
      types,
      message,
    )
    const { sha512_256 } = await import(/* webpackPrefetch: true */ 'js-sha512')
    return new ZkAccount(sha512_256(signedData), this.base.node.layer1.provider)
  }
}
