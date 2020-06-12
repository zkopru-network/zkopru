#!/usr/bin/env node

/* eslint-disable no-case-declarations */
import fs from 'fs-extra'
import { logger } from '@zkopru/utils'
import { argv } from './parser'
import { Config } from './configurator/configurator'
import { getCoordinator } from './configurator'
import { CooridnatorDashboard } from './app'

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
  logger.error(e)
  process.exit()
})
