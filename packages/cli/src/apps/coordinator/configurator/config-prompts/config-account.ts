import chalk from 'chalk'
import fs from 'fs'
import { Account } from 'web3-core'
import { makePathAbsolute } from '@zkopru/utils'
import Configurator, { Context, Menu } from '../configurator'

export default class ConfigureAccount extends Configurator {
  static code = Menu.CONFIG_ACCOUNT

  async run(context: Context): Promise<{ context: Context; next: number }> {
    console.log(chalk.blue('Setting up the coordinator account'))
    if (!context.web3) throw Error('Web3 is not loaded')
    if (this.base.keystore) {
      let password: string
      if (this.base.password) {
        password = this.base.password
      } else if (this.base.passwordFile) {
        password = fs
          .readFileSync(makePathAbsolute(this.base.passwordFile))
          .toString()
      } else {
        throw Error('Password is not configured')
      }
      const account = context.web3.eth.accounts.decrypt(
        this.base.keystore,
        password,
      )
      return { context: { ...context, account }, next: Menu.LOAD_DATABASE }
    }
    let choice: number
    if (this.base.daemon) {
      choice = 1
    } else {
      const result = await this.ask({
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
      choice = result.choice
    }

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
          console.log(
            chalk.red(
              'Invalid private key, you should prefix 0x and the private key should be 32 bytes value. Your total length of the string should be 66',
            ),
          )
        }
      }
      account = context.web3.eth.accounts.privateKeyToAccount(pk)
      context.web3.eth.accounts.wallet.add(account)
    }
    console.log(chalk.bold(`Configured account`))
    console.log(`Account: ${account.address}`)
    console.log(`Private key: ${account.privateKey}`)
    let confirmed = false
    let confirmedPassword!: string
    do {
      const { password } = this.base.password
        ? this.base
        : await this.ask({
            type: 'password',
            name: 'password',
            message: 'password',
          })
      const { retyped } = this.base.password
        ? { retyped: this.base.password }
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
      context: { ...context, keystore, account },
      next: Menu.SAVE_CONFIG,
    }
  }
}
