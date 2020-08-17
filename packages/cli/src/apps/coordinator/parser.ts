import yargs from 'yargs'
import { DEFAULT } from '../../config'

export const { argv } = yargs
  .scriptName('zkopru-coordinator')
  .usage('$0 <command> [args]')
  .options({
    address: {
      type: 'string',
      alias: 'a',
      default: DEFAULT.address,
    },
    bootstrap: {
      type: 'boolean',
      alias: 'b',
      default: true,
    },
    websocket: {
      type: 'string',
      alias: 'ws',
      default: DEFAULT.websocket,
    },
    sqlite: {
      type: 'string',
    },
    postgres: {
      type: 'string',
    },
    maxBytes: {
      type: 'number',
      default: DEFAULT.maxBytes,
    },
    priceMultiplier: {
      type: 'number',
      default: DEFAULT.priceMultiplier,
    },
    port: {
      type: 'number',
      default: DEFAULT.port,
    },
    config: {
      type: 'string',
      describe:
        'You can skip interactive booting up process with JSON configuration file',
    },
    nonInteractive: {
      type: 'boolean',
      alias: 'n',
    },
    password: {
      type: 'string',
    },
  })
  .help()
