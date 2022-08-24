import chalk from 'chalk'
import crypto from 'crypto'
import fs from 'fs'
import { PromptApp, makePathAbsolute } from '@zkopru/utils'
import { ethers } from 'ethers'
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

    const account = ethers.Wallet.createRandom()
    const securePassword = crypto.randomBytes(32).toString('hex')
    const { password } = await this.ask({
      type: 'password',
      name: 'password',
      message: `Enter a password to encrypt (press enter to use secure password):`,
      initial: securePassword,
    })
    const keystore = await account.encrypt(password)
    const { passwordFile } = await this.ask({
      type: 'text',
      name: 'passwordFile',
      message: 'Enter a path where the password should be stored',
      initial: './password.secret',
    })
    fs.writeFileSync(makePathAbsolute(passwordFile), password)
    fs.chmodSync(makePathAbsolute(passwordFile), 0o600)
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
