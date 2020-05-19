import chalk from 'chalk'
import path from 'path'
import fs from 'fs-extra'
import tar from 'tar'
import { SingleBar } from 'cli-progress'
import { https } from 'follow-redirects'
import App, { Context, Menu } from '../app'

const { print, goTo } = App

export const downloadKeys = async (url: string, path: string) => {
  return new Promise((resolve, reject) => {
    const bar = new SingleBar({
      format: `Downloading snark keys | [{bar}] | {percentage}% | {value}/{total} KiB | ETA: {eta}s`,
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
        resolve()
      })
      res.on('error', err => {
        bar.stop()
        console.error('Failed to download file')
        reject(err)
      })
    })
  })
}

export default class DownloadKeys extends App {
  async run(context: Context): Promise<Context> {
    print(chalk.blue)('Downloading keys')
    const pwd = path.join(process.cwd(), this.config.keys)
    if (fs.existsSync(pwd)) {
      return goTo(context, Menu.LOAD_DATABASE)
    }
    fs.mkdirpSync(pwd)
    try {
      await downloadKeys('https://d2xnpw7ihgc4iv.cloudfront.net/keys.tgz', pwd)
      print(chalk.green)('Download completed')
      return goTo(context, Menu.LOAD_DATABASE)
    } catch (err) {
      print(chalk.red)('Download failed', err)
      return goTo(context, Menu.EXIT)
    }
  }
}
