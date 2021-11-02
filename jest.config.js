// eslint-disable-next-line import/no-extraneous-dependencies
const { pathsToModuleNameMapper } = require('ts-jest/utils')
const { compilerOptions } = require('./tsconfig')
const base = require('./jest.config.base.js')

// For a detailed explanation regarding each configuration property, visit:
// https://jestjs.io/docs/en/configuration.html

module.exports = {
  ...base,
  projects: ['<rootDir>/packages/*/jest.config.js'],
  coverageDirectory: '<rootDir>/coverage/',
  preset: 'ts-jest',
  /** customed */
  coverageReporters: ['json', 'html'],
  moduleDirectories: ['.', 'node_modules', 'src'],
  moduleFileExtensions: ['js', 'jsx', 'ts', 'tsx'],
  moduleNameMapper: {
    ...pathsToModuleNameMapper(
      compilerOptions.paths /* , { prefix: '<rootDir>/' }, */,
    ),
  },
  testEnvironment: 'node',
}
