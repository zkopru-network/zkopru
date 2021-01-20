import chalk from 'chalk'
import Web3 from 'web3'
import crypto from 'crypto'
import fs from 'fs'
import { PromptApp, makePathAbsolute } from '@zkopru/utils'
import { Menu, ExampleConfigContext } from '../menu'

export default class Wallet extends PromptApp<ExampleConfigContext, void> {
  static code = Menu.CREATE_WALLET

  async run(
    context: ExampleConfigContext,
  ): Promise<{ context: ExampleConfigContext; next: number }> {
    console.log(chalk.blue(`Create a wallet?`))
    const { create } = await this.ask({
      type: 'confirm',
      name: 'create',
      message: `Would you like to create a wallet?`,
      initial: true,
    })
    if (!create) {
      return { context, next: Menu.SET_PUBLIC_URLS }
    }
    const web3 = new Web3()
    const account = web3.eth.accounts.create()
    const securePassword = crypto.randomBytes(32).toString('hex')
    const { password } = await this.ask({
      type: 'password',
      name: 'password',
      message: `Enter a password to encrypt (leave blank to use secure password):`,
      initial: securePassword,
    })
    const keystore = account.encrypt(password)
    const { passwordFile } = await this.ask({
      type: 'text',
      name: 'passwordFile',
      message: 'Enter a path where the password should be stored',
      initial: './password.secret',
    })
    fs.writeFileSync(makePathAbsolute(passwordFile), password)
    return {
      context: {
        config: {
          ...context.config,
          keystore,
          passwordFile,
        },
        outputPath: context.outputPath,
      },
      next: Menu.SET_PUBLIC_URLS,
    }
  }
}
