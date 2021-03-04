import chalk from 'chalk'
import { HDWallet, ZkAccount } from '@zkopru/account'
import { validateMnemonic, wordlists } from 'bip39'
import { EncryptedWallet } from '@zkopru/database'
import Configurator, { Context, Menu } from '../configurator'

export default class LoadHDWallet extends Configurator {
  static code = Menu.LOAD_HDWALLET

  async run(context: Context): Promise<{ context: Context; next: number }> {
    if (!context.db) {
      throw Error('Database is not loaded')
    }
    if (!context.web3) {
      throw Error('Web3 is not loaded')
    }
    const { web3, db } = context
    const wallet = new HDWallet(web3, db)
    let existingWallets!: EncryptedWallet[]
    if (!this.base.seedKeystore) {
      existingWallets = await wallet.list()
    }
    const createNewWallet: boolean =
      !this.base.seedKeystore && existingWallets.length === 0
    if (createNewWallet) {
      let mnemonic: string
      if (this.base.mnemonic) {
        this.print('Using imported mnemonic words')
        mnemonic = this.base.mnemonic || ''
      } else {
        const { create } = await this.ask({
          type: 'select',
          name: 'create',
          initial: 0,
          message: 'You should import mnemonic keys or create a new one.',
          choices: [
            { title: 'create', value: true },
            { title: 'import', value: false },
          ],
        })
        const { language } = await this.ask({
          type: 'select',
          name: 'language',
          initial: 8,
          message: 'Which language do you want to use for your mnemonic words?',
          choices: Object.keys(wordlists).map(lan => ({
            title: lan,
            value: lan,
          })),
        })
        const { length } = await this.ask({
          type: 'select',
          name: 'length',
          message: 'Choose your mnemonic strength',
          choices: [
            {
              title: '12',
              value: 12,
            },
            {
              title: '24',
              value: 24,
            },
          ],
        })
        const strength = length === 12 ? 128 : 256
        const wordList = wordlists[language]
        if (create) {
          mnemonic = HDWallet.newMnemonic(strength, wordList)
          this.print(`MNEMONIC: ${mnemonic}`)
          const { proceed } = await this.ask({
            type: 'confirm',
            initial: true,
            name: 'proceed',
            message:
              'You should write down this mnemonic words on your note. Proceed?',
          })
          if (!proceed) {
            return {
              context,
              next: Menu.EXIT,
            }
          }
        } else {
          const words: string[] = []
          this.print('Please type mnemonic words sequentially.')
          while (words.length !== length) {
            const { word } = await this.ask({
              type: 'text',
              name: 'word',
              message: `Type a mnemonic word for index ${words.length}.`,
            })
            if (wordList.includes(word)) {
              words.push(word)
            } else {
              this.print('Invalid mnemonic word. Try again.')
            }
          }
          mnemonic = words.join(' ')
          if (validateMnemonic(mnemonic)) {
            this.print(
              chalk.green('Great! Imported mnemonic keys successfully.'),
            )
          } else {
            console.error('Imported mnemonic is not valid.')
            const result = await this.run(context)
            return result
          }
        }
        let confirmed = false
        let confirmedPassword!: string
        do {
          const { password } = await this.ask({
            type: 'password',
            name: 'password',
            message: 'password',
          })
          const { retyped } = await this.ask({
            type: 'password',
            name: 'retyped',
            message: 'confirm password',
          })
          confirmed = password === retyped
          confirmedPassword = password
        } while (!confirmed)
        await wallet.init(mnemonic, confirmedPassword)
      }
    } else {
      let existing!: EncryptedWallet
      if (this.base.seedKeystore) {
        existing = this.base.seedKeystore
      } else if (existingWallets.length === 1) {
        existing = existingWallets[0] as EncryptedWallet
      } else if (existingWallets.length > 1) {
        const { idx } = await this.ask({
          type: 'select',
          name: 'idx',
          message: 'Which wallet do you want to use?',
          choices: existingWallets.map((obj, i) => ({
            title: obj.id || '',
            value: i,
          })),
        })
        if (idx < 0 || idx >= existingWallets.length) {
          this.print(
            chalk.red(
              `You should select between 0 - ${existingWallets.length - 1}`,
            ),
          )
          const result = await this.run(context)
          return result
        }
        existing = existingWallets[idx]
      }
      const { password } = this.base.password
        ? this.base
        : await this.ask({
            type: 'password',
            name: 'password',
            message: 'Type password',
          })
      try {
        await wallet.load(existing, password)
      } catch (err) {
        console.error(err)
        this.print('Failed to load wallet. Try again')
        const result = await this.run(context)
        return result
      }
    }
    let accounts: ZkAccount[] = await wallet.retrieveAccounts()
    if (accounts.length === 0) {
      const account = await wallet.createAccount(0)
      accounts = [account]
    }
    return {
      context: {
        ...context,
        accounts,
        wallet,
        isInitialSetup: createNewWallet,
      },
      next: Menu.CONFIG_TRACKING_ACCOUNT,
    }
  }
}
