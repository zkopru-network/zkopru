const baseConfig = require('../../jest.config.base.js')

module.exports = {
  ...baseConfig,

    preset: 'ts-jest',
    transformIgnorePatterns: [
      "node_modules/(?!@zkopru/.*)"
    ]
}
