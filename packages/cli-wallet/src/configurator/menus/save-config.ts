import chalk from 'chalk'
import path from 'path'
import fs from 'fs'
import Configurator, { Context, Menu } from '../configurator'
import { EncryptedWallet } from '.prisma/client'

const { print, goTo } = Configurator

export default class SaveConfig extends Configurator {
  static code = Menu.SAVE_CONFIG

  async run(context: Context): Promise<Context> {
    if (!context.isInitialSetup) return { ...goTo(context, Menu.COMPLETE) }

    const { save } = await this.ask({
      type: 'confirm',
      initial: true,
      name: 'save',
      message: 'Do you want to save this configuration?',
    })
    if (!save) {
      return { ...goTo(context, Menu.COMPLETE) }
    }
    let exported = false
    let seedKeystore!: EncryptedWallet
    if (!context.wallet) throw Error('Wallet is not configured')
    do {
      const { password } = await this.ask({
        type: 'password',
        name: 'password',
        message: 'Type your password',
      })
      try {
        seedKeystore = context.wallet.export(password)
        exported = true
      } catch (err) {
        exported = false
      }
    } while (!exported)
    let pathConfirmed = false
    let configPath!: string
    do {
      const { filePath } = await this.ask({
        type: 'text',
        name: 'filePath',
        initial: `${path.resolve(path.join('wallet.json'))}`,
        message: 'Save to',
      })
      configPath = filePath
      if (!fs.existsSync(filePath)) pathConfirmed = true
      else {
        const { overwrite } = await this.ask({
          type: 'confirm',
          initial: false,
          name: 'overwrite',
          message:
            'You may overwrite exising config file. Do you want to overwrite?',
        })
        pathConfirmed = overwrite
      }
    } while (!pathConfirmed)
    const newConfig = {
      ...this.config,
      seedKeystore,
      accountNumber: context.accounts?.length,
    }
    fs.writeFileSync(configPath, JSON.stringify(newConfig))
    print(chalk.blue)('Successfully created wallet.json')
    return { ...goTo(context, Menu.COMPLETE) }
  }
}
