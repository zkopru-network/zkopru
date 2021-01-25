import yargs from 'yargs'
import { DEFAULT } from './config'

export const { argv } = yargs
  .scriptName('zkopru-coordinator')
  .usage('$0 <command> [args]')
  .options({
    address: {
      type: 'string',
      alias: 'a',
      describe: `[${DEFAULT.address}]`,
    },
    bootstrap: {
      type: 'boolean',
      alias: 'b',
      describe: `[${DEFAULT.bootstrap}]`,
    },
    websocket: {
      type: 'string',
      alias: 'ws',
      describe: `[${DEFAULT.websocket}]`,
    },
    sqlite: {
      type: 'string',
    },
    postgres: {
      type: 'string',
    },
    maxBytes: {
      type: 'number',
      describe: `[${DEFAULT.maxBytes}]`,
    },
    priceMultiplier: {
      type: 'number',
      describe: `[${DEFAULT.priceMultiplier}]`,
    },
    port: {
      type: 'number',
      describe: `[${DEFAULT.port}]`,
    },
    config: {
      type: 'string',
      describe:
        'You can skip interactive booting up process with JSON configuration file',
    },
    generateConfig: {
      type: 'string',
      describe: 'Generate a sample config file',
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
      describe: `Maximum bid allowed in the burn auction (Gwei) [${DEFAULT.maxBid}]`,
    },
    publicUrls: {
      type: 'string',
      describe:
        'Comma separated list of host:port combinations this node is accessible at',
    },
  })
  .help()
