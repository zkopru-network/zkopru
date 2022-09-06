/* eslint-disable no-case-declarations */
import fs from 'fs'
import { Config } from '../src/apps/wallet/configurator/configurator'

export function loadConfig(path: string): Config {
  const config = {
    ...JSON.parse(fs.readFileSync(path).toString('utf8')),
  }
  if (!config) {
    throw Error('incorrect config path')
  }
  return config
}
