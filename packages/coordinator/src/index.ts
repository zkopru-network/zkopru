// export { Coordinator, CoordinatorInterface } from './coordinator'
export { TxMemPool, TxPoolInterface } from './tx-pool'
export { ProposerBase } from './middlewares/interfaces/proposer-base'
export { CoordinatorContext } from './context'
export { Coordinator } from './coordinator'

export enum RpcMethod {
  address = 'l1_address',
  vks = 'l1_getVKs',
  syncing = 'l2_syncing',
  blockCount = 'l2_blockCount',
  blockNumber = 'l2_blockNumber',
  blockByIndex = 'l2_getBlockByIndex',
  blockByNumber = 'l2_getBlockByNumber',
  blockByHash = 'l2_getBlockByHash',
  transactionByHash = 'l2_getTransactionByHash',
  registeredTokens = 'l2_getRegisteredTokens',
}
