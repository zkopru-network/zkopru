import fs from 'fs'
import path from 'path'
import chalk from 'chalk'
import App, { AppMenu, Context } from '..'

export default class RegisterVk extends App {
  static code = AppMenu.REGISTER_VK

  // eslint-disable-next-line class-methods-use-this
  async run(context: Context): Promise<{ context: Context; next: number }> {
    const startingPath = path.resolve('.')
    let currentPath: string = startingPath
    do {
      const base = currentPath
      const list = fs.readdirSync(base).map(f => {
        let finalPath = path.join(base, f)
        if (fs.lstatSync(finalPath).isSymbolicLink()) {
          finalPath = fs.readlinkSync(finalPath)
        }
        return {
          title: fs.lstatSync(finalPath).isDirectory() ? f : chalk.blue(f),
          value: finalPath,
        }
      })
      const isOnRoot = path.parse(process.cwd()).root === base
      const choices = isOnRoot
        ? list
        : [
            {
              title: '..',
              value: '..',
            },
            ...list,
          ]
      const { chosenPath } = await this.ask({
        type: 'select',
        name: 'chosenPath',
        message: 'Choose file',
        choices,
      })
      currentPath = chosenPath
    } while (fs.lstatSync(currentPath).isDirectory())
    const { nIn } = await this.ask({
      type: 'number',
      name: 'nIn',
      message: 'Number of input utxos',
    })
    const { nOut } = await this.ask({
      type: 'number',
      name: 'nOut',
      message: 'Number of outputs',
    })
    const vk = JSON.parse(fs.readFileSync(currentPath, 'utf8'))
    const receipt = await this.base.registerVk(nIn, nOut, vk)
    if (receipt) {
      this.print('Registered verifying key successfully')
    } else {
      this.print('Failed to register verifying key successfully')
    }
    return { context, next: AppMenu.SETUP_MENU }
  }
}
