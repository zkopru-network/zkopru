#!/usr/bin/env node

import yargs from 'yargs'

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
      default: '0x98a9b814B423B4D17Cd612cD7943986aB9BF8c41',
    },
    coordinator: {
      type: 'string',
      alias: 'r',
      default: 'https://coordinator.zkopru.network',
    },
    websocket: {
      type: 'string',
      alias: 'ws',
      default: 'ws://goerli.zkopru.network:8546',
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
