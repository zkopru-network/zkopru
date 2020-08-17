#!/usr/bin/env node

import yargs from 'yargs'
import { DEFAULT } from '../../config'

export const { argv } = yargs
  .scriptName('zk-wizard')
  .usage('$0 <command> [args]')
  .options({
    fullnode: {
      type: 'boolean',
      default: true,
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
      default: DEFAULT.networkId,
    },
    chainId: {
      type: 'number',
      alias: 'c',
      default: DEFAULT.chainId,
    },
    address: {
      type: 'string',
      alias: 'a',
      default: DEFAULT.address,
    },
    coordinator: {
      type: 'string',
      alias: 'r',
      default: DEFAULT.coordinator,
    },
    websocket: {
      type: 'string',
      alias: 'ws',
      default: DEFAULT.websocket,
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
      describe: 'You can save wallet configuration file',
    },
  })
  .help()
