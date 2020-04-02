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
  return `${prev}import { ${name}ABI } from './abis/${name}'\n`
}, '')}`

const exportContracts = `export const Contracts = {${ts.reduce((prev, name) => {
  if (name === 'types') return prev
  return `${prev}  ${name},\n`
}, '\n')}}`

const exportABIs = `export const ABIs = {${abis.reduce((prev, name) => {
  return `${prev}  ${name}ABI,\n`
}, '\n')}}`

fs.mkdirSync('./src', { recursive: true })

const src = `${importContracts}${importABIs}\n${exportContracts}\n\n${exportABIs}\n`
const formatted = prettier.format(src, {
  semi: false,
  parser: 'babel',
  singleQuote: true,
})
fs.writeFileSync('./src/index.ts', src)
