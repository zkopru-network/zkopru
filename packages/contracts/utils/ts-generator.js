console.log('> Generating abi json files')
const path = require('path')
const fs = require('fs')
// eslint-disable-next-line import/no-extraneous-dependencies
const prettier = require('prettier')

const importExportList = [
  'ICoordinatable',
  'IDepositChallenge',
  'IHeaderChallenge',
  'IMigratable',
  'IMigrationChallenge',
  'IRollUpChallenge',
  'IRollUpable',
  'ISetupWizard',
  'ITxChallenge',
  'IUserInteractable',
  'ZkOptimisticRollUp',
]

const ts = fs
  .readdirSync('./src/contracts')
  .map(filename => filename.split('.d.ts')[0])
const abis = fs
  .readdirSync('./src/abis')
  .map(filename => filename.split('.ts')[0])

const importContracts = `${ts.reduce((prev, name) => {
  if (!importExportList.includes(name)) return prev
  return `${prev}import { ${name} } from './contracts/${name}'\n`
}, '')}`

const importABIs = `${abis.reduce((prev, name) => {
  if (!importExportList.includes(name)) return prev
  return `${prev}import { ${name}ABI } from './abis/${name}'\n`
}, '')}`

const exportContracts = `${ts.reduce((prev, name) => {
  if (!importExportList.includes(name)) return prev
  return `${prev}export { ${name} } from './contracts/${name}'\n`
}, '')}`

const staticClasses = `${importExportList.reduce((prev, name) => {
  if (name === 'types') return prev
  return `${prev}
  static as${name}(
    web3: Web3,
    address: string,
    option?: ContractOptions,
  ): ${name} {
    const abi: any[] = [...${name}ABI]
    return new web3.eth.Contract(abi, address, option) as ${name}
  }
`
}, '')}`

const ZkOPRUContract = `export default class ZkOPRUContract {
  coordinator: ICoordinatable

  user: IUserInteractable

  migrator: IMigratable

  challenger: {
    deposit: IDepositChallenge
    migration: IMigrationChallenge
    header: IHeaderChallenge
    tx: ITxChallenge
    rollUp: IRollUpChallenge
    rollUpProof: IRollUpable
  }

  setup: ISetupWizard

  constructor(provider: provider, address: string, option?: ContractOptions) {
    const web3 = new Web3(provider)
    this.coordinator = ZkOPRUContract.asICoordinatable(web3, address, option)
    this.user = ZkOPRUContract.asIUserInteractable(web3, address, option)
    this.migrator = ZkOPRUContract.asIMigratable(web3, address, option)
    this.challenger = {
      deposit: ZkOPRUContract.asIDepositChallenge(web3, address, option),
      migration: ZkOPRUContract.asIMigrationChallenge(web3, address, option),
      header: ZkOPRUContract.asIHeaderChallenge(web3, address, option),
      tx: ZkOPRUContract.asITxChallenge(web3, address, option),
      rollUp: ZkOPRUContract.asIRollUpChallenge(web3, address, option),
      rollUpProof: ZkOPRUContract.asIRollUpable(web3, address, option),
    }
    this.setup = ZkOPRUContract.asISetupWizard(web3, address, option)
  }
${staticClasses}}`

const base = `/* eslint-disable @typescript-eslint/no-unused-vars */
/* eslint-disable max-classes-per-file */

import Web3 from 'web3'
import { provider } from 'web3-core'
import { ContractOptions } from 'web3-eth-contract'
`
fs.mkdirSync('./src', { recursive: true })

const src = `${base}
${importContracts}
${importABIs}
${exportContracts}
${ZkOPRUContract}
`
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
