/* eslint-disable import/no-extraneous-dependencies */
import tar from 'tar'
import path from 'path'
import fs from 'fs'
import { https } from 'follow-redirects'
import { SingleBar } from 'cli-progress'

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

  // eslint-disable-next-line prettier/prettier
;(async () => {
  const keyPath = path.join(path.dirname(__filename), '../keys')
  if (fs.existsSync(keyPath)) {
    console.log('File already exists. Skip downloading')
  } else {
    fs.mkdirSync(keyPath)
    await downloadKeys(
      'https://github.com/zkopru-network/zkopru/releases/download/20211028/keys.tgz',
      keyPath,
    )
  }
})().catch(e => {
  console.error(e)
})
