import chalk from 'chalk'
import path from 'path'
import fs from 'fs-extra'
import Configurator, { Context, Menu } from '../configurator'

export default class DownloadKeys extends Configurator {
  static code = Menu.DOWNLOAD_KEYS

  async run(context: Context): Promise<{ context: Context; next: number }> {
    if (this.base.snarkKeyCid) {
      // If a CID is provided don't download here, we'll lazily load
      return {
        context,
        next: Menu.LOAD_DATABASE,
      }
    }
    if (!this.base.snarkKeyPath) {
      this.print(chalk.red('No keys path specified!'))
      process.exit(1)
    }
    this.print(chalk.blue('Checking keys'))
    const pwd = path.join(process.cwd(), this.base.snarkKeyPath)
    if (fs.existsSync(pwd)) {
      return {
        context,
        next: Menu.LOAD_DATABASE,
      }
    }
    fs.mkdirpSync(pwd)
    return {
      context,
      next: Menu.LOAD_DATABASE,
    }
  }
}
