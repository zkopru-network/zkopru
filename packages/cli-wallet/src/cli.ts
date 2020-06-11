#!/usr/bin/env node

/* eslint-disable no-case-declarations */
import yargs from 'yargs'
import fs from 'fs'
import { logStream } from '@zkopru/utils'
import { Config } from './configurator/configurator'
import { getZkWallet } from './configurator'
import { WalletDashboard } from './app'

const { argv }: { argv: Config } = yargs
  .scriptName('zk-wizard')
  .usage('$0 <command> [args]')
  .options({
    fullnode: {
      type: 'boolean',
      default: false,
      alias: 'f',
      describe: 'Run a full-node zkopru wallet',
    },
    develop: {
      type: 'boolean',
      default: false,
      alias: 'd',
      describe: 'Run a develop version',
    },
    networkId: {
      type: 'number',
      alias: 'n',
      default: 1,
    },
    chainId: {
      type: 'number',
      alias: 'c',
      default: 1,
    },
    address: {
      type: 'string',
      alias: 'a',
      default: '0x7C728214be9A0049e6a86f2137ec61030D0AA964',
    },
    coordinator: {
      type: 'string',
      alias: 'r',
      default: 'https://coordinator.zkopru.network',
    },
    websocket: {
      type: 'string',
      alias: 'ws',
      default: 'ws://ws.zkopru.network',
    },
    keys: {
      type: 'string',
      default: 'keys',
      describe: 'Path to store SNARK keys',
    },
    sqlite: {
      type: 'string',
    },
    postgres: {
      type: 'string',
    },
    mnemonic: {
      type: 'string',
      default: undefined,
    },
    config: {
      type: 'string',
      describe: 'You can save cli-wallet configuration file',
    },
  })
  .help()

const main = async () => {
  const writeStream = fs.createWriteStream('./LOG')
  logStream.addStream(writeStream)
  // blessed.screen.render()
  let config: Config = argv
  if (argv.config) {
    config = {
      ...argv,
      ...JSON.parse(fs.readFileSync(argv.config).toString('utf8')),
    }
    if (!config.seedKeystore)
      throw Error('You should setup the keystore in the config file')
  }
  const zkWallet = await getZkWallet(config)
  if (!zkWallet) return
  const dashboard = new WalletDashboard(zkWallet, () => process.exit())
  dashboard.render()
  await dashboard.run()
}
;(async () => {
  await main()
  process.exit()
})().catch(e => {
  console.error(e)
  process.exit()
})
