#!/usr/bin/env node

import yargs from 'yargs'
import { DEFAULT } from './config'

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
    websocket: {
      type: 'string',
      alias: 'ws',
      default: DEFAULT.websocket,
    },
    snarkKeyPath: {
      type: 'string',
      describe: 'Path to local SNARK keys, overrides snarkKeyCid',
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
    snarkKeyCid: {
      type: 'string',
      default: '/ipfs/QmWdQnPVdbS61ERWJY76xfkbzrLDiQptE81LRTQUupSP7G',
      describe: 'An IPFS content identifier storing the proving keys',
    },
  })
  .help()
