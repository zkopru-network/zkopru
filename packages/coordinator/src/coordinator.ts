// import { Hex } from 'web3-utils'
// import { ZkTx } from '@zkopru/core'
// import Web3 from 'web3'
// import { ITxPool } from './tx_pool'
// import { ISyncrhonizer } from './synchronizer'
// import { Watchdog } from './watchdog'
// import { Proposer } from './proposer'
// import { API } from './api'

// export interface Block {
//   header: Header
//   body: Body
// }

// export interface Header {
//   proposer: Hex
//   parentBlock: Hex
//   metadata: Hex
//   fee: Hex
//   /** UTXO roll up  */
//   prevUTXORoot: Hex
//   prevUTXOIndex: Hex
//   nextUTXORoot: Hex
//   nextUTXOIndex: Hex
//   /** Nullifier roll up  */
//   prevNullifierRoot: Hex
//   nextNullifierRoot: Hex
//   prevWithdrawalRoot: Hex
//   prevWithdrawalIndex: Hex
//   /** Withdrawal roll up  */
//   nextWithdrawalRoot: Hex
//   nextWithdrawalIndex: Hex
//   /** Transactions */
//   txRoot: Hex
//   depositRoot: Hex
//   migrationRoot: Hex
// }

// export interface Body {
//   txs: ZkTx[]
//   deposits: MassDeposit[]
//   migrations: MassMigration[]
// }

// export interface MassDeposit {
//   merged: Hex
//   fee: Hex
// }

// export interface MassMigration {
//   destination: Hex
//   totalETH: Hex
//   migratingLeaves: MassDeposit
//   erc20: ERC20Migration[]
//   erc721: ERC721Migration[]
// }

// export interface ERC20Migration {
//   addr: Hex
//   amount: Hex
// }

// export interface ERC721Migration {
//   addr: Hex
//   nfts: Hex[]
// }

// export interface AggregatedZkTx {
//   zkTx: ZkTx
//   includedIn: Hex // block hash
// }

// export interface CoordinatorInterface {
//   start()
//   onTxRequest(handler: (tx: ZkTx) => Promise<string>): void
//   onBlock()
// }

// export class Coordinator {
//   api: API

//   proposer: Proposer

//   watchdog: Watchdog

//   synchronizer: ISyncrhonizer

//   txPool: ITxPool

//   constructor(
//     web3: Web3,
//     api: API,
//     txPool: ITxPool,
//     synchronizer: ISyncrhonizer,
//   ) {
//     this.proposer = new Proposer(web3)
//     this.watchdog = new Watchdog(web3)
//     this.txPool = txPool
//     this.synchronizer = synchronizer
//     this.api = api
//   }

//   start() {
//     this.api.onTxRequest(async tx => {
//       return await this.txPool.addToTxPool(tx).catch(err => err)
//     })
//   }

//   stop() {}
// }
