/* eslint-disable no-case-declarations */
import fs from 'fs'

export function loadConfig(path: string): any {
  const config = {
    ...JSON.parse(fs.readFileSync(path).toString('utf8')),
  }
  if (!config) {
    throw Error('incorrect config path')
  }
  return config
}
