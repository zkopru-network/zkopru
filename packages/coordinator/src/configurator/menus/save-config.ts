import chalk from 'chalk'
import path from 'path'
import fs from 'fs'
import Configurator, { Context, Menu } from '../configurator'

export default class SaveConfig extends Configurator {
  static code = Menu.SAVE_CONFIG

  async run(context: Context): Promise<{ context: Context; next: number }> {
    const { save } = await this.ask({
      type: 'confirm',
      initial: true,
      name: 'save',
      message: 'Do you want to save this configuration?',
    })
    if (!save) {
      return { context, next: Menu.LOAD_DATABASE }
    }
    let password!: string
    const { savePassword } = await this.ask({
      type: 'confirm',
      initial: false,
      name: 'savePassword',
      message:
        'To skip interactive configuration process, you can configure password by --password option or saving it to the config file.\nDo you want to save it?',
    })
    if (savePassword) {
      let confirmed = false
      do {
        const { retyped } = await this.ask({
          type: 'password',
          name: 'retyped',
          message: 'Re-type your password',
        })
        password = retyped
        try {
          if (!context.web3 || !context.keystore)
            throw Error('web3 or keystore is not configured')
          context.web3.eth.accounts.decrypt(context.keystore, password)
          confirmed = true
        } catch (err) {
          confirmed = false
        }
      } while (!confirmed)
    }
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
      ...this.base,
      keystore: context.keystore,
      password: savePassword ? password : undefined,
    }
    fs.writeFileSync(configPath, JSON.stringify(newConfig))
    console.log(chalk.blue('Successfully created coordinator.json'))
    return { context, next: Menu.LOAD_DATABASE }
  }
}
