import yargs from 'yargs'

export const { argv } = yargs
  .scriptName('zkopru-coordinator')
  .usage('$0 <command> [args]')
  .options({
    address: {
      type: 'string',
      alias: 'a',
      default: '0xe2229A6dc8516236967a6e70fF854C17B871C8b4',
    },
    bootstrap: {
      type: 'boolean',
      alias: 'b',
      default: true,
    },
    websocket: {
      type: 'string',
      alias: 'ws',
      default: 'ws://goerli.zkopru.network:8546',
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
    nonInteractive: {
      type: 'boolean',
      alias: 'n',
    },
    password: {
      type: 'string',
    },
  })
  .help()
