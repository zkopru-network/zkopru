const baseConfig = require('../../jest.config.base.js')

module.exports = {
  ...baseConfig,
  setupFiles: ['fake-indexeddb/auto'],
}
