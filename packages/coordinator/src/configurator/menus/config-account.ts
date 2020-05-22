import chalk from 'chalk'
import { Account } from 'web3-core'
import Configurator, { Context, Menu } from '../configurator'

const { print, goTo } = Configurator

export default class ConfigureAccount extends Configurator {
  static code = Menu.CONFIG_ACCOUNT

  async run(context: Context): Promise<Context> {
    print(chalk.blue)('Setting up the coordinator account')
    if (!context.web3) throw Error('Web3 is not loaded')
    if (this.config.keystore) {
      if (!this.config.password) throw Error('Password is not configured')
      const account = context.web3.eth.accounts.decrypt(
        this.config.keystore,
        this.config.password,
      )
      context.web3.eth.personal.importRawKey(
        account.privateKey,
        this.config.password,
      )
      context.web3.eth.personal.unlockAccount(
        account.address,
        this.config.password,
        0,
      )
      return { ...goTo(context, Menu.LOAD_DATABASE), account }
    }
    const { choice } = await this.ask({
      type: 'select',
      name: 'choice',
      message: 'You need to configure an Ethereum account for coordination',
      initial: 0,
      choices: [
        {
          title: 'Do you want to import an exising private key?',
          value: 0,
        },
        {
          title: 'Do you want to create a new one?',
          value: 1,
        },
      ],
    })
    let account: Account
    if (choice === 1) {
      account = context.web3.eth.accounts.create()
    } else {
      let pk!: string
      while (pk === undefined) {
        try {
          const { privateKey } = await this.ask({
            type: 'text',
            name: 'privateKey',
            message: 'Type hex type of private key including prefixed 0x',
            initial: '0x',
          })
          pk = privateKey
        } catch (e) {
          print(chalk.red)(
            'Invalid private key, you should prefix 0x and the private key should be 32 bytes value. Your total length of the string should be 66',
          )
        }
      }
      account = context.web3.eth.accounts.privateKeyToAccount(pk)
      context.web3.eth.accounts.wallet.add(account)
    }
    print(chalk.bold)(`Configured account`)
    print()(`Account: ${account.address}`)
    print()(`Private key: ${account.privateKey}`)
    let confirmed = false
    let confirmedPassword!: string
    do {
      const { password } = this.config.password
        ? this.config
        : await this.ask({
            type: 'password',
            name: 'password',
            message: 'password',
          })
      const { retyped } = this.config.password
        ? { retyped: this.config.password }
        : await this.ask({
            type: 'password',
            name: 'retyped',
            message: 'confirm password',
          })
      confirmed = password === retyped
      confirmedPassword = password
    } while (!confirmed)

    const keystore = account.encrypt(confirmedPassword)
    return {
      ...goTo(context, Menu.SAVE_CONFIG),
      keystore,
      account,
    }
  }
}
