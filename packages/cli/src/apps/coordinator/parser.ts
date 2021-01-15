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
    daemon: {
      type: 'boolean',
      alias: 'd',
      describe: 'Start as a daemon',
    },
    password: {
      type: 'string',
    },
    passwordFile: {
      type: 'string',
      describe: 'Path to a plaintext file to be used as the keystore password',
    },
    keystoreFile: {
      type: 'string',
      describe: 'Path to an Ethereum keystore file',
    },
    maxBid: {
      type: 'number',
      describe: 'Maximum bid allowed in the burn auction (Gwei)',
      default: DEFAULT.maxBid,
    },
    publicUrls: {
      type: 'string',
      describe:
        'Comma separated list of host:port combinations this node is accessible at',
    },
  })
  .help()
