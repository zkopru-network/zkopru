import chalk from 'chalk'
import path from 'path'
import fs from 'fs-extra'
import tar from 'tar'
import { SingleBar } from 'cli-progress'
import { https } from 'follow-redirects'
import { Writable } from 'stream'
import Configurator, { Context, Menu } from '../configurator'
import { DEFAULT } from '../../config'

export const downloadKeys = async (
  url: string,
  path: string,
  stream?: Writable,
) => {
  return new Promise((resolve, reject) => {
    const bar = new SingleBar({
      format: `Downloading snark keys | [{bar}] | {percentage}% | {value}/{total} KiB | ETA: {eta}s`,
      stream,
    })
    let fileLength = 0
    let downloaded = 0
    https.get(url, res => {
      res.pipe(
        tar.x({
          strip: 1,
          C: path,
        }),
      )
      fileLength = parseInt(res.headers['content-length'] || '0', 10)
      bar.start(Math.floor(fileLength / 1024), 0)
      res.on('data', chunk => {
        downloaded += chunk.length
        bar.update(Math.floor(downloaded / 1024))
      })
      res.on('end', () => {
        bar.stop()
        resolve(null)
      })
      res.on('error', err => {
        bar.stop()
        console.error('Failed to download file')
        reject(err)
      })
    })
  })
}

export default class DownloadKeys extends Configurator {
  static code = Menu.DOWNLOAD_KEYS

  async run(context: Context): Promise<{ context: Context; next: number }> {
    this.print(chalk.blue('Downloading keys'))
    const pwd = path.join(process.cwd(), this.base.keys)
    if (fs.existsSync(pwd)) {
      return {
        context,
        next: Menu.LOAD_DATABASE,
      }
    }
    fs.mkdirpSync(pwd)
    try {
      await downloadKeys(DEFAULT.snarkkeys, pwd, process.stdout)
      this.print(chalk.green('Download completed'))
      return {
        context,
        next: Menu.LOAD_DATABASE,
      }
    } catch (err) {
      this.print(chalk.red('Download failed', err))
      return {
        context,
        next: Menu.EXIT,
      }
    }
  }
}
