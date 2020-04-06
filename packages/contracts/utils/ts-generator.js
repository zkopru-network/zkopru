console.log('> Generating abi json files')
const path = require('path')
const fs = require('fs')
// eslint-disable-next-line import/no-extraneous-dependencies
const prettier = require('prettier')

const ts = fs
  .readdirSync('./src/contracts')
  .map(filename => filename.split('.d.ts')[0])
const abis = fs
  .readdirSync('./src/abis')
  .map(filename => filename.split('.ts')[0])

const importContracts = `${ts.reduce((prev, name) => {
  if (name === 'types') return prev
  return `${prev}import { ${name} } from './contracts/${name}'\n`
}, '')}`

const importABIs = `${abis.reduce((prev, name) => {
  if (!ts.includes(name)) return prev
  return `${prev}import { ${name}ABI } from './abis/${name}'\n`
}, '')}`

const exportContracts = `${ts.reduce((prev, name) => {
  if (name === 'types') return prev
  return `${prev}export { ${name} } from './contracts/${name}'\n`
}, '')}`

const staticClasses = `${ts.reduce((prev, name) => {
  if (name === 'types') return prev
  return `${prev}
  static as${name}(
    web3: Web3,
    address: string,
    option: ContractOptions,
  ): ${name} {
    const abi: any[] = [...${name}ABI]
    return new web3.eth.Contract(abi, address, option) as ${name}
  }
`
}, '')}`

const ZkOPRUContract = `export default class ZkOPRUContract {${staticClasses}}`

const base = `/* eslint-disable @typescript-eslint/no-unused-vars */
/* eslint-disable max-classes-per-file */

import Web3 from 'web3'
import { ContractOptions } from 'web3-eth-contract'
`
fs.mkdirSync('./src', { recursive: true })

const src = `${base}${importContracts}${importABIs}\n${exportContracts}\n${ZkOPRUContract}\n`
// const src = `${importContracts}\n${importABIs}\n${exportContracts}\n\n${exportABIs}\n`
const formatted = prettier.format(src, {
  semi: false,
  parser: 'typescript',
  singleQuote: true,
  useTabs: false,
  tabWidth: 2,
  trailingComma: 'all',
  endOfLine: 'lf',
})
fs.writeFileSync('./src/index.ts', src)
