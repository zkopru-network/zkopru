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

const importContracts = list =>
  `${ts.reduce((prev, name) => {
    if (!list.includes(name)) return prev
    return `${prev}import { ${name} } from './contracts/${name}'\n`
  }, '')}`

const zkopruTS = `import Web3 from 'web3'
import { ContractOptions } from 'web3-eth-contract'
${importContracts([
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
])}
import { Layer1 } from './layer1'

export class ZkOPRUContract {
  upstream: ZkOptimisticRollUp

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

  constructor(web3: Web3, address: string, option?: ContractOptions) {
    this.upstream = Layer1.getZkOptimisticRollUp(web3, address, option)
    this.coordinator = Layer1.getICoordinatable(web3, address, option)
    this.user = Layer1.getIUserInteractable(web3, address, option)
    this.migrator = Layer1.getIMigratable(web3, address, option)
    this.challenger = {
      deposit: Layer1.getIDepositChallenge(web3, address, option),
      migration: Layer1.getIMigrationChallenge(web3, address, option),
      header: Layer1.getIHeaderChallenge(web3, address, option),
      tx: Layer1.getITxChallenge(web3, address, option),
      rollUp: Layer1.getIRollUpChallenge(web3, address, option),
      rollUpProof: Layer1.getIRollUpable(web3, address, option),
    }
    this.setup = Layer1.getISetupWizard(web3, address, option)
  }
}`

const list = [
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
  'ERC20',
  'ERC721',
  'IERC721Enumerable',
  'ZkOptimisticRollUp',
]
const importABIs = list =>
  `${abis.reduce((prev, name) => {
    if (!list.includes(name)) return prev
    return `${prev}import { ${name}ABI } from './abis/${name}'\n`
  }, '')}`

const staticClasses = list =>
  `${list.reduce((prev, name) => {
    if (name === 'types') return prev
    return `${prev}
  static get${name}(
    web3: Web3,
    address: string,
    option?: ContractOptions,
  ): ${name} {
    const abi: any[] = [...${name}ABI]
    return new web3.eth.Contract(abi, address, option) as ${name}
  }
`
  }, '')}`

const layer1TS = `/* eslint-disable @typescript-eslint/no-explicit-any */
import Web3 from 'web3'
import { ContractOptions } from 'web3-eth-contract'
${importContracts(list)}
${importABIs(list)}

export class Layer1 {
${staticClasses(list)}
}
`

fs.mkdirSync('./src', { recursive: true })

fs.writeFileSync(
  './src/layer1.ts',
  prettier.format(layer1TS, {
    semi: false,
    parser: 'typescript',
    singleQuote: true,
    useTabs: false,
    tabWidth: 2,
    trailingComma: 'all',
    endOfLine: 'lf',
  }),
)

fs.writeFileSync(
  './src/zkopru.ts',
  prettier.format(zkopruTS, {
    semi: false,
    parser: 'typescript',
    singleQuote: true,
    useTabs: false,
    tabWidth: 2,
    trailingComma: 'all',
    endOfLine: 'lf',
  }),
)
