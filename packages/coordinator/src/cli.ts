#!/usr/bin/env node

/* eslint-disable no-case-declarations */
import yargs from 'yargs'
import fs from 'fs-extra'
import { logger } from '@zkopru/utils'
import { Config } from './configurator/configurator'
import { getCoordinator } from './configurator'
import { CooridnatorDashboard } from './app'

const { argv } = yargs
  .scriptName('zkopru-coordinator')
  .usage('$0 <command> [args]')
  .options({
    address: {
      type: 'string',
      alias: 'a',
      default: '0x7C728214be9A0049e6a86f2137ec61030D0AA964',
    },
    bootstrap: {
      type: 'boolean',
      alias: 'b',
      default: true,
    },
    websocket: {
      type: 'string',
      alias: 'ws',
      default: 'ws://ws.zkopru.network',
    },
    sqlite: {
      type: 'string',
    },
    postgres: {
      type: 'string',
    },
    maxBytes: {
      type: 'number',
      default: 131072,
    },
    priceMultiplier: {
      type: 'number',
      default: 48,
    },
    port: {
      type: 'number',
      default: 8888,
    },
    config: {
      type: 'string',
      describe:
        'You can skip interactive booting up process with JSON configuration file',
    },
    n: {
      type: 'boolean',
      alias: 'nonInteractive',
    },
    password: {
      type: 'string',
    },
  })
  .help()

const main = async () => {
  let config: Config = argv
  if (argv.config) {
    config = JSON.parse(fs.readFileSync(argv.config).toString('utf8'))
    if (!config.keystore)
      throw Error('You should setup the keystore in the config file')
  }
  const coordinator = await getCoordinator(config)
  if (argv.n) {
    logger.info('Run non-interactive mode')
    return new Promise(res => {
      if (!coordinator) throw Error('Failed to load coordinator')
      coordinator.start()
      coordinator.on('stop', res)
    })
  }
  logger.info('Run interactive mode')
  const dashboard = new CooridnatorDashboard(coordinator, () => process.exit())
  dashboard.render()
  await dashboard.run()
}
;(async () => {
  await main()
  process.exit()
})().catch(e => {
  console.error(e)
})
