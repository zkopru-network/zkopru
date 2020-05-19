import chalk from 'chalk'
import { Account } from 'web3-core'
import path from 'path'
import fs from 'fs'
import App, { Context, Menu } from '../app'

const { print, goTo } = App

export default class ConfigureAccount extends App {
  async run(context: Context): Promise<Context> {
    print(chalk.blue)('Setting up the coordinator account')
    if (!context.web3) throw Error('Web3 is not loaded')
    if (this.config.keystore) {
      if (!this.config.password) throw Error('Password is not configured')
      context.web3.eth.accounts.decrypt(
        this.config.keystore,
        this.config.password,
      )
      return { ...goTo(context, Menu.LOAD_DATABASE) }
    }
    console.log('trying to configure')
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
    console.log(choice)
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
    }
    print(chalk.bold)(`Configured account`)
    print()(`Account: ${account.address}`)
    print()(`Account: ${account.privateKey}`)
    const { password } = await this.ask({
      type: 'password',
      name: 'password',
      message: 'password',
    })
    const keystore = account.encrypt(password)
    const { save } = await this.ask({
      type: 'confirm',
      initial: true,
      name: 'save',
      message: 'Do you want to save this configuration?',
    })
    if (save) {
      const { savePassword } = await this.ask({
        type: 'confirm',
        initial: false,
        name: 'savePassword',
        message:
          'You can skip this interactive configuration process if you save the password together.\nDo you want to save it?',
      })
      let pathConfirmed = false
      let configPath!: string
      do {
        const { filePath } = await this.ask({
          type: 'text',
          name: 'filePath',
          initial: `${path.resolve(path.join('coordinator.json'))}`,
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
        keystore,
        password: savePassword ? password : undefined,
      }
      fs.writeFileSync(configPath, JSON.stringify(newConfig))
      print(chalk.blue)('Successfully created coordinator.json')
    }
    return { ...goTo(context, Menu.LOAD_DATABASE), keystore, password }
  }
}
