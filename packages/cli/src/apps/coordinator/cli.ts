#!/usr/bin/env node

/* eslint-disable no-case-declarations */
import fs from 'fs-extra'
import { logStream, logger, makePathAbsolute } from '@zkopru/utils'
import { argv } from './parser'
import { Config } from './configurator/configurator'
import { getCoordinator } from './configurator'
import { CoordinatorDashboard } from './app'

const main = async () => {
  const writeStream = fs.createWriteStream('./COORDINATOR_LOG')
  logStream.addStream(writeStream)
  const config: Config = {} as Config
  if (argv.config) {
    const configFile = JSON.parse(
      fs.readFileSync(makePathAbsolute(argv.config)).toString('utf8'),
    )
    Object.assign(config, configFile)
  }
  // Let command line arguments override config file arguments
  Object.assign(config, argv)
  // Load keystore if needed
  if (config.keystoreFile) {
    if (config.keystore) {
      logger.info(
        `Overriding provided keystore with keystore at ${config.keystoreFile}`,
      )
    }
    const keystore = JSON.parse(
      fs.readFileSync(makePathAbsolute(config.keystoreFile)).toString(),
    )
    Object.assign(config, { keystore })
  }
  if (!config.keystore) {
    throw Error('You must provide either a keystore or keystore file')
  }
  const coordinator = await getCoordinator(config)
  if (config.daemon) {
    logger.info('Run non-interactive mode')
    if (!coordinator) throw Error('Failed to load coordinator')
    await coordinator.start()
    return new Promise<void>(res => coordinator.on('stop', res))
  }
  logger.info('Run interactive mode')
  const dashboard = new CoordinatorDashboard(coordinator, () => process.exit())
  dashboard.render()
  await dashboard.run()
}
;(async () => {
  try {
    await main()
    process.exit()
  } catch (err) {
    console.log(err)
    process.exit(1)
  }
})()
