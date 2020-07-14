#!/usr/bin/env node

import yargs from 'yargs'

export const { argv } = yargs
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
      default: 'https://coordinator.zkopru.network:8888',
    },
    websocket: {
      type: 'string',
      alias: 'ws',
      default: 'wss://goerli.infura.io/ws/v3/903b5c8ce616421db0a335ba3a761022',
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
