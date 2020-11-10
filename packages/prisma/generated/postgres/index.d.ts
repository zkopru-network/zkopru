import {
  DMMF,
  DMMFClass,
  Engine,
  PrismaClientKnownRequestError,
  PrismaClientUnknownRequestError,
  PrismaClientRustPanicError,
  PrismaClientInitializationError,
  PrismaClientValidationError,
  sqltag as sql,
  empty,
  join,
  raw,
} from './runtime';

export { PrismaClientKnownRequestError }
export { PrismaClientUnknownRequestError }
export { PrismaClientRustPanicError }
export { PrismaClientInitializationError }
export { PrismaClientValidationError }

/**
 * Re-export of sql-template-tag
 */
export { sql, empty, join, raw }

/**
 * Prisma Client JS version: 2.7.1
 * Query Engine version: 5c2ad460cf4fe8c9330e6640b266c046542c8b6a
 */
export declare type PrismaVersion = {
  client: string
}

export declare const prismaVersion: PrismaVersion 

/**
 * Utility Types
 */

/**
 * From https://github.com/sindresorhus/type-fest/
 * Matches a JSON object.
 * This type can be useful to enforce some input to be JSON-compatible or as a super-type to be extended from. 
 */
export declare type JsonObject = {[Key in string]?: JsonValue}
 
/**
 * From https://github.com/sindresorhus/type-fest/
 * Matches a JSON array.
 */
export declare interface JsonArray extends Array<JsonValue> {}
 
/**
 * From https://github.com/sindresorhus/type-fest/
 * Matches any valid JSON value.
 */
export declare type JsonValue = string | number | boolean | null | JsonObject | JsonArray

/**
 * Same as JsonObject, but allows undefined
 */
export declare type InputJsonObject = {[Key in string]?: JsonValue}
 
export declare interface InputJsonArray extends Array<JsonValue> {}
 
export declare type InputJsonValue = undefined |  string | number | boolean | null | InputJsonObject | InputJsonArray

declare type SelectAndInclude = {
  select: any
  include: any
}

declare type HasSelect = {
  select: any
}

declare type HasInclude = {
  include: any
}

declare type CheckSelect<T, S, U> = T extends SelectAndInclude
  ? 'Please either choose `select` or `include`'
  : T extends HasSelect
  ? U
  : T extends HasInclude
  ? U
  : S

/**
 * Get the type of the value, that the Promise holds.
 */
export declare type PromiseType<T extends PromiseLike<any>> = T extends PromiseLike<infer U> ? U : T;

/**
 * Get the return type of a function which returns a Promise.
 */
export declare type PromiseReturnType<T extends (...args: any) => Promise<any>> = PromiseType<ReturnType<T>>


export declare type Enumerable<T> = T | Array<T>;

export type RequiredKeys<T> = {
  [K in keyof T]-?: {} extends Pick<T, K> ? never : K
}[keyof T]

export declare type TruthyKeys<T> = {
  [key in keyof T]: T[key] extends false | undefined | null ? never : key
}[keyof T]

export declare type TrueKeys<T> = TruthyKeys<Pick<T, RequiredKeys<T>>>

/**
 * Subset
 * @desc From `T` pick properties that exist in `U`. Simple version of Intersection
 */
export declare type Subset<T, U> = {
  [key in keyof T]: key extends keyof U ? T[key] : never;
};
declare class PrismaClientFetcher {
  private readonly prisma;
  private readonly debug;
  private readonly hooks?;
  constructor(prisma: PrismaClient<any, any>, debug?: boolean, hooks?: Hooks | undefined);
  request<T>(document: any, dataPath?: string[], rootField?: string, typeName?: string, isList?: boolean, callsite?: string): Promise<T>;
  sanitizeMessage(message: string): string;
  protected unpack(document: any, data: any, path: string[], rootField?: string, isList?: boolean): any;
}


/**
 * Client
**/

export declare type Datasource = {
  url?: string
}

export type Datasources = {
  postgres?: Datasource
}

export type ErrorFormat = 'pretty' | 'colorless' | 'minimal'

export interface PrismaClientOptions {
  /**
   * Overwrites the datasource url from your prisma.schema file
   */
  datasources?: Datasources

  /**
   * @default "colorless"
   */
  errorFormat?: ErrorFormat

  /**
   * @example
   * ```
   * // Defaults to stdout
   * log: ['query', 'info', 'warn', 'error']
   * 
   * // Emit as events
   * log: [
   *  { emit: 'stdout', level: 'query' },
   *  { emit: 'stdout', level: 'info' },
   *  { emit: 'stdout', level: 'warn' }
   *  { emit: 'stdout', level: 'error' }
   * ]
   * ```
   * Read more in our [docs](https://www.prisma.io/docs/reference/tools-and-interfaces/prisma-client/logging#the-log-option).
   */
  log?: Array<LogLevel | LogDefinition>
}

export type Hooks = {
  beforeRequest?: (options: {query: string, path: string[], rootField?: string, typeName?: string, document: any}) => any
}

/* Types for Logging */
export type LogLevel = 'info' | 'query' | 'warn' | 'error'
export type LogDefinition = {
  level: LogLevel
  emit: 'stdout' | 'event'
}

export type GetLogType<T extends LogLevel | LogDefinition> = T extends LogDefinition ? T['emit'] extends 'event' ? T['level'] : never : never
export type GetEvents<T extends any> = T extends Array<LogLevel | LogDefinition> ?
  GetLogType<T[0]> | GetLogType<T[1]> | GetLogType<T[2]> | GetLogType<T[3]>
  : never

export type QueryEvent = {
  timestamp: Date
  query: string
  params: string
  duration: number
  target: string
}

export type LogEvent = {
  timestamp: Date
  message: string
  target: string
}
/* End Types for Logging */


export type PrismaAction =
  | 'findOne'
  | 'findMany'
  | 'create'
  | 'update'
  | 'updateMany'
  | 'upsert'
  | 'delete'
  | 'deleteMany'
  | 'executeRaw'
  | 'queryRaw'
  | 'aggregate'

/**
 * These options are being passed in to the middleware as "params"
 */
export type MiddlewareParams = {
  model?: string
  action: PrismaAction
  args: any
  dataPath: string[]
  runInTransaction: boolean
}

/**
 * The `T` type makes sure, that the `return proceed` is not forgotten in the middleware implementation
 */
export type Middleware<T = any> = (
  params: MiddlewareParams,
  next: (params: MiddlewareParams) => Promise<T>,
) => Promise<T>

// tested in getLogLevel.test.ts
export declare function getLogLevel(log: Array<LogLevel | LogDefinition>): LogLevel | undefined;

/**
 * ##  Prisma Client ʲˢ
 * 
 * Type-safe database client for TypeScript & Node.js (ORM replacement)
 * @example
 * ```
 * const prisma = new PrismaClient()
 * // Fetch zero or more EncryptedWallets
 * const encryptedWallets = await prisma.encryptedWallet.findMany()
 * ```
 *
 * 
 * Read more in our [docs](https://www.prisma.io/docs/reference/tools-and-interfaces/prisma-client).
 */
export declare class PrismaClient<
  T extends PrismaClientOptions = PrismaClientOptions,
  U = 'log' extends keyof T ? T['log'] extends Array<LogLevel | LogDefinition> ? GetEvents<T['log']> : never : never
> {
  /**
   * @private
   */
  private fetcher;
  /**
   * @private
   */
  private readonly dmmf;
  /**
   * @private
   */
  private connectionPromise?;
  /**
   * @private
   */
  private disconnectionPromise?;
  /**
   * @private
   */
  private readonly engineConfig;
  /**
   * @private
   */
  private readonly measurePerformance;
  /**
   * @private
   */
  private engine: Engine;
  /**
   * @private
   */
  private errorFormat: ErrorFormat;

  /**
   * ##  Prisma Client ʲˢ
   * 
   * Type-safe database client for TypeScript & Node.js (ORM replacement)
   * @example
   * ```
   * const prisma = new PrismaClient()
   * // Fetch zero or more EncryptedWallets
   * const encryptedWallets = await prisma.encryptedWallet.findMany()
   * ```
   *
   * 
   * Read more in our [docs](https://www.prisma.io/docs/reference/tools-and-interfaces/prisma-client).
   */
  constructor(optionsArg?: T);
  $on<V extends U>(eventType: V, callback: (event: V extends 'query' ? QueryEvent : LogEvent) => void): void;
  /**
   * @deprecated renamed to `$on`
   */
  on<V extends U>(eventType: V, callback: (event: V extends 'query' ? QueryEvent : LogEvent) => void): void;
  /**
   * Connect with the database
   */
  $connect(): Promise<void>;
  /**
   * @deprecated renamed to `$connect`
   */
  connect(): Promise<void>;

  /**
   * Disconnect from the database
   */
  $disconnect(): Promise<any>;
  /**
   * @deprecated renamed to `$disconnect`
   */
  disconnect(): Promise<any>;

  /**
   * Add a middleware
   */
  $use(cb: Middleware): void

  /**
   * Executes a raw query and returns the number of affected rows
   * @example
   * ```
   * // With parameters use prisma.executeRaw``, values will be escaped automatically
   * const result = await prisma.executeRaw`UPDATE User SET cool = ${true} WHERE id = ${1};`
   * // Or
   * const result = await prisma.executeRaw('UPDATE User SET cool = $1 WHERE id = $2 ;', true, 1)
  * ```
  * 
  * Read more in our [docs](https://www.prisma.io/docs/reference/tools-and-interfaces/prisma-client/raw-database-access).
  */
  $executeRaw<T = any>(query: string | TemplateStringsArray, ...values: any[]): Promise<number>;

  /**
   * @deprecated renamed to `$executeRaw`
   */
  executeRaw<T = any>(query: string | TemplateStringsArray, ...values: any[]): Promise<number>;

  /**
   * Performs a raw query and returns the SELECT data
   * @example
   * ```
   * // With parameters use prisma.queryRaw``, values will be escaped automatically
   * const result = await prisma.queryRaw`SELECT * FROM User WHERE id = ${1} OR email = ${'ema.il'};`
   * // Or
   * const result = await prisma.queryRaw('SELECT * FROM User WHERE id = $1 OR email = $2;', 1, 'ema.il')
  * ```
  * 
  * Read more in our [docs](https://www.prisma.io/docs/reference/tools-and-interfaces/prisma-client/raw-database-access).
  */
  $queryRaw<T = any>(query: string | TemplateStringsArray, ...values: any[]): Promise<T>;
 
  /**
   * @deprecated renamed to `$queryRaw`
   */
  queryRaw<T = any>(query: string | TemplateStringsArray, ...values: any[]): Promise<T>;

  /**
   * Execute queries in a transaction
   * @example
   * ```
   * const [george, bob, alice] = await prisma.transaction([
   *   prisma.user.create({ data: { name: 'George' } }),
   *   prisma.user.create({ data: { name: 'Bob' } }),
   *   prisma.user.create({ data: { name: 'Alice' } }),
   * ])
   * ```
   */
  $transaction: PromiseConstructor['all']
  /**
   * @deprecated renamed to `$transaction`
   */
  transaction: PromiseConstructor['all']

  /**
   * `prisma.encryptedWallet`: Exposes CRUD operations for the **EncryptedWallet** model.
    * Example usage:
    * ```ts
    * // Fetch zero or more EncryptedWallets
    * const encryptedWallets = await prisma.encryptedWallet.findMany()
    * ```
    */
  get encryptedWallet(): EncryptedWalletDelegate;

  /**
   * `prisma.keystore`: Exposes CRUD operations for the **Keystore** model.
    * Example usage:
    * ```ts
    * // Fetch zero or more Keystores
    * const keystores = await prisma.keystore.findMany()
    * ```
    */
  get keystore(): KeystoreDelegate;

  /**
   * `prisma.config`: Exposes CRUD operations for the **Config** model.
    * Example usage:
    * ```ts
    * // Fetch zero or more Configs
    * const configs = await prisma.config.findMany()
    * ```
    */
  get config(): ConfigDelegate;

  /**
   * `prisma.tracker`: Exposes CRUD operations for the **Tracker** model.
    * Example usage:
    * ```ts
    * // Fetch zero or more Trackers
    * const trackers = await prisma.tracker.findMany()
    * ```
    */
  get tracker(): TrackerDelegate;

  /**
   * `prisma.proposal`: Exposes CRUD operations for the **Proposal** model.
    * Example usage:
    * ```ts
    * // Fetch zero or more Proposals
    * const proposals = await prisma.proposal.findMany()
    * ```
    */
  get proposal(): ProposalDelegate;

  /**
   * `prisma.block`: Exposes CRUD operations for the **Block** model.
    * Example usage:
    * ```ts
    * // Fetch zero or more Blocks
    * const blocks = await prisma.block.findMany()
    * ```
    */
  get block(): BlockDelegate;

  /**
   * `prisma.slash`: Exposes CRUD operations for the **Slash** model.
    * Example usage:
    * ```ts
    * // Fetch zero or more Slashes
    * const slashes = await prisma.slash.findMany()
    * ```
    */
  get slash(): SlashDelegate;

  /**
   * `prisma.header`: Exposes CRUD operations for the **Header** model.
    * Example usage:
    * ```ts
    * // Fetch zero or more Headers
    * const headers = await prisma.header.findMany()
    * ```
    */
  get header(): HeaderDelegate;

  /**
   * `prisma.bootstrap`: Exposes CRUD operations for the **Bootstrap** model.
    * Example usage:
    * ```ts
    * // Fetch zero or more Bootstraps
    * const bootstraps = await prisma.bootstrap.findMany()
    * ```
    */
  get bootstrap(): BootstrapDelegate;

  /**
   * `prisma.massDeposit`: Exposes CRUD operations for the **MassDeposit** model.
    * Example usage:
    * ```ts
    * // Fetch zero or more MassDeposits
    * const massDeposits = await prisma.massDeposit.findMany()
    * ```
    */
  get massDeposit(): MassDepositDelegate;

  /**
   * `prisma.deposit`: Exposes CRUD operations for the **Deposit** model.
    * Example usage:
    * ```ts
    * // Fetch zero or more Deposits
    * const deposits = await prisma.deposit.findMany()
    * ```
    */
  get deposit(): DepositDelegate;

  /**
   * `prisma.utxo`: Exposes CRUD operations for the **Utxo** model.
    * Example usage:
    * ```ts
    * // Fetch zero or more Utxos
    * const utxos = await prisma.utxo.findMany()
    * ```
    */
  get utxo(): UtxoDelegate;

  /**
   * `prisma.withdrawal`: Exposes CRUD operations for the **Withdrawal** model.
    * Example usage:
    * ```ts
    * // Fetch zero or more Withdrawals
    * const withdrawals = await prisma.withdrawal.findMany()
    * ```
    */
  get withdrawal(): WithdrawalDelegate;

  /**
   * `prisma.migration`: Exposes CRUD operations for the **Migration** model.
    * Example usage:
    * ```ts
    * // Fetch zero or more Migrations
    * const migrations = await prisma.migration.findMany()
    * ```
    */
  get migration(): MigrationDelegate;

  /**
   * `prisma.treeNode`: Exposes CRUD operations for the **TreeNode** model.
    * Example usage:
    * ```ts
    * // Fetch zero or more TreeNodes
    * const treeNodes = await prisma.treeNode.findMany()
    * ```
    */
  get treeNode(): TreeNodeDelegate;

  /**
   * `prisma.lightTree`: Exposes CRUD operations for the **LightTree** model.
    * Example usage:
    * ```ts
    * // Fetch zero or more LightTrees
    * const lightTrees = await prisma.lightTree.findMany()
    * ```
    */
  get lightTree(): LightTreeDelegate;

  /**
   * `prisma.tokenRegistry`: Exposes CRUD operations for the **TokenRegistry** model.
    * Example usage:
    * ```ts
    * // Fetch zero or more TokenRegistries
    * const tokenRegistries = await prisma.tokenRegistry.findMany()
    * ```
    */
  get tokenRegistry(): TokenRegistryDelegate;
}



/**
 * Enums
 */

// Based on
// https://github.com/microsoft/TypeScript/issues/3192#issuecomment-261720275

export declare const EncryptedWalletDistinctFieldEnum: {
  id: 'id',
  ciphertext: 'ciphertext',
  iv: 'iv',
  algorithm: 'algorithm',
  keylen: 'keylen',
  kdf: 'kdf',
  N: 'N',
  r: 'r',
  p: 'p',
  salt: 'salt'
};

export declare type EncryptedWalletDistinctFieldEnum = (typeof EncryptedWalletDistinctFieldEnum)[keyof typeof EncryptedWalletDistinctFieldEnum]


export declare const KeystoreDistinctFieldEnum: {
  address: 'address',
  zkAddress: 'zkAddress',
  encrypted: 'encrypted'
};

export declare type KeystoreDistinctFieldEnum = (typeof KeystoreDistinctFieldEnum)[keyof typeof KeystoreDistinctFieldEnum]


export declare const ConfigDistinctFieldEnum: {
  id: 'id',
  networkId: 'networkId',
  chainId: 'chainId',
  address: 'address',
  utxoTreeDepth: 'utxoTreeDepth',
  withdrawalTreeDepth: 'withdrawalTreeDepth',
  nullifierTreeDepth: 'nullifierTreeDepth',
  challengePeriod: 'challengePeriod',
  minimumStake: 'minimumStake',
  referenceDepth: 'referenceDepth',
  maxUtxo: 'maxUtxo',
  maxWithdrawal: 'maxWithdrawal',
  utxoSubTreeDepth: 'utxoSubTreeDepth',
  utxoSubTreeSize: 'utxoSubTreeSize',
  withdrawalSubTreeDepth: 'withdrawalSubTreeDepth',
  withdrawalSubTreeSize: 'withdrawalSubTreeSize'
};

export declare type ConfigDistinctFieldEnum = (typeof ConfigDistinctFieldEnum)[keyof typeof ConfigDistinctFieldEnum]


export declare const TrackerDistinctFieldEnum: {
  id: 'id',
  viewer: 'viewer',
  address: 'address'
};

export declare type TrackerDistinctFieldEnum = (typeof TrackerDistinctFieldEnum)[keyof typeof TrackerDistinctFieldEnum]


export declare const ProposalDistinctFieldEnum: {
  hash: 'hash',
  proposalNum: 'proposalNum',
  proposedAt: 'proposedAt',
  proposalTx: 'proposalTx',
  proposalData: 'proposalData',
  fetched: 'fetched',
  finalized: 'finalized',
  verified: 'verified',
  isUncle: 'isUncle'
};

export declare type ProposalDistinctFieldEnum = (typeof ProposalDistinctFieldEnum)[keyof typeof ProposalDistinctFieldEnum]


export declare const BlockDistinctFieldEnum: {
  hash: 'hash'
};

export declare type BlockDistinctFieldEnum = (typeof BlockDistinctFieldEnum)[keyof typeof BlockDistinctFieldEnum]


export declare const SlashDistinctFieldEnum: {
  hash: 'hash',
  proposer: 'proposer',
  reason: 'reason',
  executionTx: 'executionTx',
  slashedAt: 'slashedAt'
};

export declare type SlashDistinctFieldEnum = (typeof SlashDistinctFieldEnum)[keyof typeof SlashDistinctFieldEnum]


export declare const HeaderDistinctFieldEnum: {
  hash: 'hash',
  proposer: 'proposer',
  parentBlock: 'parentBlock',
  fee: 'fee',
  utxoRoot: 'utxoRoot',
  utxoIndex: 'utxoIndex',
  nullifierRoot: 'nullifierRoot',
  withdrawalRoot: 'withdrawalRoot',
  withdrawalIndex: 'withdrawalIndex',
  txRoot: 'txRoot',
  depositRoot: 'depositRoot',
  migrationRoot: 'migrationRoot'
};

export declare type HeaderDistinctFieldEnum = (typeof HeaderDistinctFieldEnum)[keyof typeof HeaderDistinctFieldEnum]


export declare const BootstrapDistinctFieldEnum: {
  id: 'id',
  blockHash: 'blockHash',
  utxoBootstrap: 'utxoBootstrap',
  withdrawalBootstrap: 'withdrawalBootstrap'
};

export declare type BootstrapDistinctFieldEnum = (typeof BootstrapDistinctFieldEnum)[keyof typeof BootstrapDistinctFieldEnum]


export declare const MassDepositDistinctFieldEnum: {
  index: 'index',
  merged: 'merged',
  fee: 'fee',
  blockNumber: 'blockNumber',
  includedIn: 'includedIn'
};

export declare type MassDepositDistinctFieldEnum = (typeof MassDepositDistinctFieldEnum)[keyof typeof MassDepositDistinctFieldEnum]


export declare const DepositDistinctFieldEnum: {
  note: 'note',
  fee: 'fee',
  transactionIndex: 'transactionIndex',
  logIndex: 'logIndex',
  blockNumber: 'blockNumber',
  queuedAt: 'queuedAt'
};

export declare type DepositDistinctFieldEnum = (typeof DepositDistinctFieldEnum)[keyof typeof DepositDistinctFieldEnum]


export declare const UtxoDistinctFieldEnum: {
  hash: 'hash',
  eth: 'eth',
  owner: 'owner',
  salt: 'salt',
  tokenAddr: 'tokenAddr',
  erc20Amount: 'erc20Amount',
  nft: 'nft',
  status: 'status',
  treeId: 'treeId',
  index: 'index',
  nullifier: 'nullifier',
  usedAt: 'usedAt'
};

export declare type UtxoDistinctFieldEnum = (typeof UtxoDistinctFieldEnum)[keyof typeof UtxoDistinctFieldEnum]


export declare const WithdrawalDistinctFieldEnum: {
  hash: 'hash',
  withdrawalHash: 'withdrawalHash',
  eth: 'eth',
  owner: 'owner',
  salt: 'salt',
  tokenAddr: 'tokenAddr',
  erc20Amount: 'erc20Amount',
  nft: 'nft',
  to: 'to',
  fee: 'fee',
  status: 'status',
  treeId: 'treeId',
  index: 'index',
  includedIn: 'includedIn',
  prepayer: 'prepayer',
  siblings: 'siblings'
};

export declare type WithdrawalDistinctFieldEnum = (typeof WithdrawalDistinctFieldEnum)[keyof typeof WithdrawalDistinctFieldEnum]


export declare const MigrationDistinctFieldEnum: {
  hash: 'hash',
  eth: 'eth',
  owner: 'owner',
  salt: 'salt',
  tokenAddr: 'tokenAddr',
  erc20Amount: 'erc20Amount',
  nft: 'nft',
  to: 'to',
  fee: 'fee',
  status: 'status',
  treeId: 'treeId',
  index: 'index',
  usedFor: 'usedFor'
};

export declare type MigrationDistinctFieldEnum = (typeof MigrationDistinctFieldEnum)[keyof typeof MigrationDistinctFieldEnum]


export declare const TreeNodeDistinctFieldEnum: {
  treeId: 'treeId',
  nodeIndex: 'nodeIndex',
  value: 'value'
};

export declare type TreeNodeDistinctFieldEnum = (typeof TreeNodeDistinctFieldEnum)[keyof typeof TreeNodeDistinctFieldEnum]


export declare const LightTreeDistinctFieldEnum: {
  id: 'id',
  species: 'species',
  start: 'start',
  end: 'end',
  root: 'root',
  index: 'index',
  siblings: 'siblings'
};

export declare type LightTreeDistinctFieldEnum = (typeof LightTreeDistinctFieldEnum)[keyof typeof LightTreeDistinctFieldEnum]


export declare const TokenRegistryDistinctFieldEnum: {
  address: 'address',
  isERC20: 'isERC20',
  isERC721: 'isERC721',
  identifier: 'identifier',
  blockNumber: 'blockNumber'
};

export declare type TokenRegistryDistinctFieldEnum = (typeof TokenRegistryDistinctFieldEnum)[keyof typeof TokenRegistryDistinctFieldEnum]


export declare const SortOrder: {
  asc: 'asc',
  desc: 'desc'
};

export declare type SortOrder = (typeof SortOrder)[keyof typeof SortOrder]



/**
 * Model EncryptedWallet
 */

export type EncryptedWallet = {
  id: string
  ciphertext: string
  iv: string
  algorithm: string
  keylen: number
  kdf: string
  N: number
  r: number
  p: number
  salt: string
}


export type AggregateEncryptedWallet = {
  count: number
  avg: EncryptedWalletAvgAggregateOutputType | null
  sum: EncryptedWalletSumAggregateOutputType | null
  min: EncryptedWalletMinAggregateOutputType | null
  max: EncryptedWalletMaxAggregateOutputType | null
}

export type EncryptedWalletAvgAggregateOutputType = {
  keylen: number
  N: number
  r: number
  p: number
}

export type EncryptedWalletSumAggregateOutputType = {
  keylen: number
  N: number
  r: number
  p: number
}

export type EncryptedWalletMinAggregateOutputType = {
  keylen: number
  N: number
  r: number
  p: number
}

export type EncryptedWalletMaxAggregateOutputType = {
  keylen: number
  N: number
  r: number
  p: number
}


export type EncryptedWalletAvgAggregateInputType = {
  keylen?: true
  N?: true
  r?: true
  p?: true
}

export type EncryptedWalletSumAggregateInputType = {
  keylen?: true
  N?: true
  r?: true
  p?: true
}

export type EncryptedWalletMinAggregateInputType = {
  keylen?: true
  N?: true
  r?: true
  p?: true
}

export type EncryptedWalletMaxAggregateInputType = {
  keylen?: true
  N?: true
  r?: true
  p?: true
}

export type AggregateEncryptedWalletArgs = {
  where?: EncryptedWalletWhereInput
  orderBy?: Enumerable<EncryptedWalletOrderByInput>
  cursor?: EncryptedWalletWhereUniqueInput
  take?: number
  skip?: number
  distinct?: Enumerable<EncryptedWalletDistinctFieldEnum>
  count?: true
  avg?: EncryptedWalletAvgAggregateInputType
  sum?: EncryptedWalletSumAggregateInputType
  min?: EncryptedWalletMinAggregateInputType
  max?: EncryptedWalletMaxAggregateInputType
}

export type GetEncryptedWalletAggregateType<T extends AggregateEncryptedWalletArgs> = {
  [P in keyof T]: P extends 'count' ? number : GetEncryptedWalletAggregateScalarType<T[P]>
}

export type GetEncryptedWalletAggregateScalarType<T extends any> = {
  [P in keyof T]: P extends keyof EncryptedWalletAvgAggregateOutputType ? EncryptedWalletAvgAggregateOutputType[P] : never
}
    
    

export type EncryptedWalletSelect = {
  id?: boolean
  ciphertext?: boolean
  iv?: boolean
  algorithm?: boolean
  keylen?: boolean
  kdf?: boolean
  N?: boolean
  r?: boolean
  p?: boolean
  salt?: boolean
}

export type EncryptedWalletGetPayload<
  S extends boolean | null | undefined | EncryptedWalletArgs,
  U = keyof S
> = S extends true
  ? EncryptedWallet
  : S extends undefined
  ? never
  : S extends EncryptedWalletArgs | FindManyEncryptedWalletArgs
  ? 'include' extends U
    ? EncryptedWallet 
  : 'select' extends U
    ? {
      [P in TrueKeys<S['select']>]:P extends keyof EncryptedWallet ? EncryptedWallet[P]
: 
 never
    }
  : EncryptedWallet
: EncryptedWallet


export interface EncryptedWalletDelegate {
  /**
   * Find zero or one EncryptedWallet.
   * @param {FindOneEncryptedWalletArgs} args - Arguments to find a EncryptedWallet
   * @example
   * // Get one EncryptedWallet
   * const encryptedWallet = await prisma.encryptedWallet.findOne({
   *   where: {
   *     // ... provide filter here
   *   }
   * })
  **/
  findOne<T extends FindOneEncryptedWalletArgs>(
    args: Subset<T, FindOneEncryptedWalletArgs>
  ): CheckSelect<T, Prisma__EncryptedWalletClient<EncryptedWallet | null>, Prisma__EncryptedWalletClient<EncryptedWalletGetPayload<T> | null>>
  /**
   * Find zero or more EncryptedWallets.
   * @param {FindManyEncryptedWalletArgs=} args - Arguments to filter and select certain fields only.
   * @example
   * // Get all EncryptedWallets
   * const encryptedWallets = await prisma.encryptedWallet.findMany()
   * 
   * // Get first 10 EncryptedWallets
   * const encryptedWallets = await prisma.encryptedWallet.findMany({ take: 10 })
   * 
   * // Only select the `id`
   * const encryptedWalletWithIdOnly = await prisma.encryptedWallet.findMany({ select: { id: true } })
   * 
  **/
  findMany<T extends FindManyEncryptedWalletArgs>(
    args?: Subset<T, FindManyEncryptedWalletArgs>
  ): CheckSelect<T, Promise<Array<EncryptedWallet>>, Promise<Array<EncryptedWalletGetPayload<T>>>>
  /**
   * Create a EncryptedWallet.
   * @param {EncryptedWalletCreateArgs} args - Arguments to create a EncryptedWallet.
   * @example
   * // Create one EncryptedWallet
   * const EncryptedWallet = await prisma.encryptedWallet.create({
   *   data: {
   *     // ... data to create a EncryptedWallet
   *   }
   * })
   * 
  **/
  create<T extends EncryptedWalletCreateArgs>(
    args: Subset<T, EncryptedWalletCreateArgs>
  ): CheckSelect<T, Prisma__EncryptedWalletClient<EncryptedWallet>, Prisma__EncryptedWalletClient<EncryptedWalletGetPayload<T>>>
  /**
   * Delete a EncryptedWallet.
   * @param {EncryptedWalletDeleteArgs} args - Arguments to delete one EncryptedWallet.
   * @example
   * // Delete one EncryptedWallet
   * const EncryptedWallet = await prisma.encryptedWallet.delete({
   *   where: {
   *     // ... filter to delete one EncryptedWallet
   *   }
   * })
   * 
  **/
  delete<T extends EncryptedWalletDeleteArgs>(
    args: Subset<T, EncryptedWalletDeleteArgs>
  ): CheckSelect<T, Prisma__EncryptedWalletClient<EncryptedWallet>, Prisma__EncryptedWalletClient<EncryptedWalletGetPayload<T>>>
  /**
   * Update one EncryptedWallet.
   * @param {EncryptedWalletUpdateArgs} args - Arguments to update one EncryptedWallet.
   * @example
   * // Update one EncryptedWallet
   * const encryptedWallet = await prisma.encryptedWallet.update({
   *   where: {
   *     // ... provide filter here
   *   },
   *   data: {
   *     // ... provide data here
   *   }
   * })
   * 
  **/
  update<T extends EncryptedWalletUpdateArgs>(
    args: Subset<T, EncryptedWalletUpdateArgs>
  ): CheckSelect<T, Prisma__EncryptedWalletClient<EncryptedWallet>, Prisma__EncryptedWalletClient<EncryptedWalletGetPayload<T>>>
  /**
   * Delete zero or more EncryptedWallets.
   * @param {EncryptedWalletDeleteManyArgs} args - Arguments to filter EncryptedWallets to delete.
   * @example
   * // Delete a few EncryptedWallets
   * const { count } = await prisma.encryptedWallet.deleteMany({
   *   where: {
   *     // ... provide filter here
   *   }
   * })
   * 
  **/
  deleteMany<T extends EncryptedWalletDeleteManyArgs>(
    args: Subset<T, EncryptedWalletDeleteManyArgs>
  ): Promise<BatchPayload>
  /**
   * Update zero or more EncryptedWallets.
   * @param {EncryptedWalletUpdateManyArgs} args - Arguments to update one or more rows.
   * @example
   * // Update many EncryptedWallets
   * const encryptedWallet = await prisma.encryptedWallet.updateMany({
   *   where: {
   *     // ... provide filter here
   *   },
   *   data: {
   *     // ... provide data here
   *   }
   * })
   * 
  **/
  updateMany<T extends EncryptedWalletUpdateManyArgs>(
    args: Subset<T, EncryptedWalletUpdateManyArgs>
  ): Promise<BatchPayload>
  /**
   * Create or update one EncryptedWallet.
   * @param {EncryptedWalletUpsertArgs} args - Arguments to update or create a EncryptedWallet.
   * @example
   * // Update or create a EncryptedWallet
   * const encryptedWallet = await prisma.encryptedWallet.upsert({
   *   create: {
   *     // ... data to create a EncryptedWallet
   *   },
   *   update: {
   *     // ... in case it already exists, update
   *   },
   *   where: {
   *     // ... the filter for the EncryptedWallet we want to update
   *   }
   * })
  **/
  upsert<T extends EncryptedWalletUpsertArgs>(
    args: Subset<T, EncryptedWalletUpsertArgs>
  ): CheckSelect<T, Prisma__EncryptedWalletClient<EncryptedWallet>, Prisma__EncryptedWalletClient<EncryptedWalletGetPayload<T>>>
  /**
   * Count
   */
  count(args?: Omit<FindManyEncryptedWalletArgs, 'select' | 'include'>): Promise<number>

  /**
   * Aggregate
   */
  aggregate<T extends AggregateEncryptedWalletArgs>(args: Subset<T, AggregateEncryptedWalletArgs>): Promise<GetEncryptedWalletAggregateType<T>>
}

/**
 * The delegate class that acts as a "Promise-like" for EncryptedWallet.
 * Why is this prefixed with `Prisma__`?
 * Because we want to prevent naming conflicts as mentioned in 
 * https://github.com/prisma/prisma-client-js/issues/707
 */
export declare class Prisma__EncryptedWalletClient<T> implements Promise<T> {
  private readonly _dmmf;
  private readonly _fetcher;
  private readonly _queryType;
  private readonly _rootField;
  private readonly _clientMethod;
  private readonly _args;
  private readonly _dataPath;
  private readonly _errorFormat;
  private readonly _measurePerformance?;
  private _isList;
  private _callsite;
  private _requestPromise?;
  constructor(_dmmf: DMMFClass, _fetcher: PrismaClientFetcher, _queryType: 'query' | 'mutation', _rootField: string, _clientMethod: string, _args: any, _dataPath: string[], _errorFormat: ErrorFormat, _measurePerformance?: boolean | undefined, _isList?: boolean);
  readonly [Symbol.toStringTag]: 'PrismaClientPromise';


  private get _document();
  /**
   * Attaches callbacks for the resolution and/or rejection of the Promise.
   * @param onfulfilled The callback to execute when the Promise is resolved.
   * @param onrejected The callback to execute when the Promise is rejected.
   * @returns A Promise for the completion of which ever callback is executed.
   */
  then<TResult1 = T, TResult2 = never>(onfulfilled?: ((value: T) => TResult1 | Promise<TResult1>) | undefined | null, onrejected?: ((reason: any) => TResult2 | Promise<TResult2>) | undefined | null): Promise<TResult1 | TResult2>;
  /**
   * Attaches a callback for only the rejection of the Promise.
   * @param onrejected The callback to execute when the Promise is rejected.
   * @returns A Promise for the completion of the callback.
   */
  catch<TResult = never>(onrejected?: ((reason: any) => TResult | Promise<TResult>) | undefined | null): Promise<T | TResult>;
  /**
   * Attaches a callback that is invoked when the Promise is settled (fulfilled or rejected). The
   * resolved value cannot be modified from the callback.
   * @param onfinally The callback to execute when the Promise is settled (fulfilled or rejected).
   * @returns A Promise for the completion of the callback.
   */
  finally(onfinally?: (() => void) | undefined | null): Promise<T>;
}

// Custom InputTypes

/**
 * EncryptedWallet findOne
 */
export type FindOneEncryptedWalletArgs = {
  /**
   * Select specific fields to fetch from the EncryptedWallet
  **/
  select?: EncryptedWalletSelect | null
  /**
   * Filter, which EncryptedWallet to fetch.
  **/
  where: EncryptedWalletWhereUniqueInput
}


/**
 * EncryptedWallet findMany
 */
export type FindManyEncryptedWalletArgs = {
  /**
   * Select specific fields to fetch from the EncryptedWallet
  **/
  select?: EncryptedWalletSelect | null
  /**
   * Filter, which EncryptedWallets to fetch.
  **/
  where?: EncryptedWalletWhereInput
  /**
   * Determine the order of the EncryptedWallets to fetch.
  **/
  orderBy?: Enumerable<EncryptedWalletOrderByInput>
  /**
   * Sets the position for listing EncryptedWallets.
  **/
  cursor?: EncryptedWalletWhereUniqueInput
  /**
   * The number of EncryptedWallets to fetch. If negative number, it will take EncryptedWallets before the `cursor`.
  **/
  take?: number
  /**
   * Skip the first `n` EncryptedWallets.
  **/
  skip?: number
  distinct?: Enumerable<EncryptedWalletDistinctFieldEnum>
}


/**
 * EncryptedWallet create
 */
export type EncryptedWalletCreateArgs = {
  /**
   * Select specific fields to fetch from the EncryptedWallet
  **/
  select?: EncryptedWalletSelect | null
  /**
   * The data needed to create a EncryptedWallet.
  **/
  data: EncryptedWalletCreateInput
}


/**
 * EncryptedWallet update
 */
export type EncryptedWalletUpdateArgs = {
  /**
   * Select specific fields to fetch from the EncryptedWallet
  **/
  select?: EncryptedWalletSelect | null
  /**
   * The data needed to update a EncryptedWallet.
  **/
  data: EncryptedWalletUpdateInput
  /**
   * Choose, which EncryptedWallet to update.
  **/
  where: EncryptedWalletWhereUniqueInput
}


/**
 * EncryptedWallet updateMany
 */
export type EncryptedWalletUpdateManyArgs = {
  data: EncryptedWalletUpdateManyMutationInput
  where?: EncryptedWalletWhereInput
}


/**
 * EncryptedWallet upsert
 */
export type EncryptedWalletUpsertArgs = {
  /**
   * Select specific fields to fetch from the EncryptedWallet
  **/
  select?: EncryptedWalletSelect | null
  /**
   * The filter to search for the EncryptedWallet to update in case it exists.
  **/
  where: EncryptedWalletWhereUniqueInput
  /**
   * In case the EncryptedWallet found by the `where` argument doesn't exist, create a new EncryptedWallet with this data.
  **/
  create: EncryptedWalletCreateInput
  /**
   * In case the EncryptedWallet was found with the provided `where` argument, update it with this data.
  **/
  update: EncryptedWalletUpdateInput
}


/**
 * EncryptedWallet delete
 */
export type EncryptedWalletDeleteArgs = {
  /**
   * Select specific fields to fetch from the EncryptedWallet
  **/
  select?: EncryptedWalletSelect | null
  /**
   * Filter which EncryptedWallet to delete.
  **/
  where: EncryptedWalletWhereUniqueInput
}


/**
 * EncryptedWallet deleteMany
 */
export type EncryptedWalletDeleteManyArgs = {
  where?: EncryptedWalletWhereInput
}


/**
 * EncryptedWallet without action
 */
export type EncryptedWalletArgs = {
  /**
   * Select specific fields to fetch from the EncryptedWallet
  **/
  select?: EncryptedWalletSelect | null
}



/**
 * Model Keystore
 */

export type Keystore = {
  address: string
  zkAddress: string
  encrypted: string
}


export type AggregateKeystore = {
  count: number
}



export type AggregateKeystoreArgs = {
  where?: KeystoreWhereInput
  orderBy?: Enumerable<KeystoreOrderByInput>
  cursor?: KeystoreWhereUniqueInput
  take?: number
  skip?: number
  distinct?: Enumerable<KeystoreDistinctFieldEnum>
  count?: true
}

export type GetKeystoreAggregateType<T extends AggregateKeystoreArgs> = {
  [P in keyof T]: P extends 'count' ? number : never
}


    
    

export type KeystoreSelect = {
  address?: boolean
  zkAddress?: boolean
  encrypted?: boolean
}

export type KeystoreGetPayload<
  S extends boolean | null | undefined | KeystoreArgs,
  U = keyof S
> = S extends true
  ? Keystore
  : S extends undefined
  ? never
  : S extends KeystoreArgs | FindManyKeystoreArgs
  ? 'include' extends U
    ? Keystore 
  : 'select' extends U
    ? {
      [P in TrueKeys<S['select']>]:P extends keyof Keystore ? Keystore[P]
: 
 never
    }
  : Keystore
: Keystore


export interface KeystoreDelegate {
  /**
   * Find zero or one Keystore.
   * @param {FindOneKeystoreArgs} args - Arguments to find a Keystore
   * @example
   * // Get one Keystore
   * const keystore = await prisma.keystore.findOne({
   *   where: {
   *     // ... provide filter here
   *   }
   * })
  **/
  findOne<T extends FindOneKeystoreArgs>(
    args: Subset<T, FindOneKeystoreArgs>
  ): CheckSelect<T, Prisma__KeystoreClient<Keystore | null>, Prisma__KeystoreClient<KeystoreGetPayload<T> | null>>
  /**
   * Find zero or more Keystores.
   * @param {FindManyKeystoreArgs=} args - Arguments to filter and select certain fields only.
   * @example
   * // Get all Keystores
   * const keystores = await prisma.keystore.findMany()
   * 
   * // Get first 10 Keystores
   * const keystores = await prisma.keystore.findMany({ take: 10 })
   * 
   * // Only select the `address`
   * const keystoreWithAddressOnly = await prisma.keystore.findMany({ select: { address: true } })
   * 
  **/
  findMany<T extends FindManyKeystoreArgs>(
    args?: Subset<T, FindManyKeystoreArgs>
  ): CheckSelect<T, Promise<Array<Keystore>>, Promise<Array<KeystoreGetPayload<T>>>>
  /**
   * Create a Keystore.
   * @param {KeystoreCreateArgs} args - Arguments to create a Keystore.
   * @example
   * // Create one Keystore
   * const Keystore = await prisma.keystore.create({
   *   data: {
   *     // ... data to create a Keystore
   *   }
   * })
   * 
  **/
  create<T extends KeystoreCreateArgs>(
    args: Subset<T, KeystoreCreateArgs>
  ): CheckSelect<T, Prisma__KeystoreClient<Keystore>, Prisma__KeystoreClient<KeystoreGetPayload<T>>>
  /**
   * Delete a Keystore.
   * @param {KeystoreDeleteArgs} args - Arguments to delete one Keystore.
   * @example
   * // Delete one Keystore
   * const Keystore = await prisma.keystore.delete({
   *   where: {
   *     // ... filter to delete one Keystore
   *   }
   * })
   * 
  **/
  delete<T extends KeystoreDeleteArgs>(
    args: Subset<T, KeystoreDeleteArgs>
  ): CheckSelect<T, Prisma__KeystoreClient<Keystore>, Prisma__KeystoreClient<KeystoreGetPayload<T>>>
  /**
   * Update one Keystore.
   * @param {KeystoreUpdateArgs} args - Arguments to update one Keystore.
   * @example
   * // Update one Keystore
   * const keystore = await prisma.keystore.update({
   *   where: {
   *     // ... provide filter here
   *   },
   *   data: {
   *     // ... provide data here
   *   }
   * })
   * 
  **/
  update<T extends KeystoreUpdateArgs>(
    args: Subset<T, KeystoreUpdateArgs>
  ): CheckSelect<T, Prisma__KeystoreClient<Keystore>, Prisma__KeystoreClient<KeystoreGetPayload<T>>>
  /**
   * Delete zero or more Keystores.
   * @param {KeystoreDeleteManyArgs} args - Arguments to filter Keystores to delete.
   * @example
   * // Delete a few Keystores
   * const { count } = await prisma.keystore.deleteMany({
   *   where: {
   *     // ... provide filter here
   *   }
   * })
   * 
  **/
  deleteMany<T extends KeystoreDeleteManyArgs>(
    args: Subset<T, KeystoreDeleteManyArgs>
  ): Promise<BatchPayload>
  /**
   * Update zero or more Keystores.
   * @param {KeystoreUpdateManyArgs} args - Arguments to update one or more rows.
   * @example
   * // Update many Keystores
   * const keystore = await prisma.keystore.updateMany({
   *   where: {
   *     // ... provide filter here
   *   },
   *   data: {
   *     // ... provide data here
   *   }
   * })
   * 
  **/
  updateMany<T extends KeystoreUpdateManyArgs>(
    args: Subset<T, KeystoreUpdateManyArgs>
  ): Promise<BatchPayload>
  /**
   * Create or update one Keystore.
   * @param {KeystoreUpsertArgs} args - Arguments to update or create a Keystore.
   * @example
   * // Update or create a Keystore
   * const keystore = await prisma.keystore.upsert({
   *   create: {
   *     // ... data to create a Keystore
   *   },
   *   update: {
   *     // ... in case it already exists, update
   *   },
   *   where: {
   *     // ... the filter for the Keystore we want to update
   *   }
   * })
  **/
  upsert<T extends KeystoreUpsertArgs>(
    args: Subset<T, KeystoreUpsertArgs>
  ): CheckSelect<T, Prisma__KeystoreClient<Keystore>, Prisma__KeystoreClient<KeystoreGetPayload<T>>>
  /**
   * Count
   */
  count(args?: Omit<FindManyKeystoreArgs, 'select' | 'include'>): Promise<number>

  /**
   * Aggregate
   */
  aggregate<T extends AggregateKeystoreArgs>(args: Subset<T, AggregateKeystoreArgs>): Promise<GetKeystoreAggregateType<T>>
}

/**
 * The delegate class that acts as a "Promise-like" for Keystore.
 * Why is this prefixed with `Prisma__`?
 * Because we want to prevent naming conflicts as mentioned in 
 * https://github.com/prisma/prisma-client-js/issues/707
 */
export declare class Prisma__KeystoreClient<T> implements Promise<T> {
  private readonly _dmmf;
  private readonly _fetcher;
  private readonly _queryType;
  private readonly _rootField;
  private readonly _clientMethod;
  private readonly _args;
  private readonly _dataPath;
  private readonly _errorFormat;
  private readonly _measurePerformance?;
  private _isList;
  private _callsite;
  private _requestPromise?;
  constructor(_dmmf: DMMFClass, _fetcher: PrismaClientFetcher, _queryType: 'query' | 'mutation', _rootField: string, _clientMethod: string, _args: any, _dataPath: string[], _errorFormat: ErrorFormat, _measurePerformance?: boolean | undefined, _isList?: boolean);
  readonly [Symbol.toStringTag]: 'PrismaClientPromise';


  private get _document();
  /**
   * Attaches callbacks for the resolution and/or rejection of the Promise.
   * @param onfulfilled The callback to execute when the Promise is resolved.
   * @param onrejected The callback to execute when the Promise is rejected.
   * @returns A Promise for the completion of which ever callback is executed.
   */
  then<TResult1 = T, TResult2 = never>(onfulfilled?: ((value: T) => TResult1 | Promise<TResult1>) | undefined | null, onrejected?: ((reason: any) => TResult2 | Promise<TResult2>) | undefined | null): Promise<TResult1 | TResult2>;
  /**
   * Attaches a callback for only the rejection of the Promise.
   * @param onrejected The callback to execute when the Promise is rejected.
   * @returns A Promise for the completion of the callback.
   */
  catch<TResult = never>(onrejected?: ((reason: any) => TResult | Promise<TResult>) | undefined | null): Promise<T | TResult>;
  /**
   * Attaches a callback that is invoked when the Promise is settled (fulfilled or rejected). The
   * resolved value cannot be modified from the callback.
   * @param onfinally The callback to execute when the Promise is settled (fulfilled or rejected).
   * @returns A Promise for the completion of the callback.
   */
  finally(onfinally?: (() => void) | undefined | null): Promise<T>;
}

// Custom InputTypes

/**
 * Keystore findOne
 */
export type FindOneKeystoreArgs = {
  /**
   * Select specific fields to fetch from the Keystore
  **/
  select?: KeystoreSelect | null
  /**
   * Filter, which Keystore to fetch.
  **/
  where: KeystoreWhereUniqueInput
}


/**
 * Keystore findMany
 */
export type FindManyKeystoreArgs = {
  /**
   * Select specific fields to fetch from the Keystore
  **/
  select?: KeystoreSelect | null
  /**
   * Filter, which Keystores to fetch.
  **/
  where?: KeystoreWhereInput
  /**
   * Determine the order of the Keystores to fetch.
  **/
  orderBy?: Enumerable<KeystoreOrderByInput>
  /**
   * Sets the position for listing Keystores.
  **/
  cursor?: KeystoreWhereUniqueInput
  /**
   * The number of Keystores to fetch. If negative number, it will take Keystores before the `cursor`.
  **/
  take?: number
  /**
   * Skip the first `n` Keystores.
  **/
  skip?: number
  distinct?: Enumerable<KeystoreDistinctFieldEnum>
}


/**
 * Keystore create
 */
export type KeystoreCreateArgs = {
  /**
   * Select specific fields to fetch from the Keystore
  **/
  select?: KeystoreSelect | null
  /**
   * The data needed to create a Keystore.
  **/
  data: KeystoreCreateInput
}


/**
 * Keystore update
 */
export type KeystoreUpdateArgs = {
  /**
   * Select specific fields to fetch from the Keystore
  **/
  select?: KeystoreSelect | null
  /**
   * The data needed to update a Keystore.
  **/
  data: KeystoreUpdateInput
  /**
   * Choose, which Keystore to update.
  **/
  where: KeystoreWhereUniqueInput
}


/**
 * Keystore updateMany
 */
export type KeystoreUpdateManyArgs = {
  data: KeystoreUpdateManyMutationInput
  where?: KeystoreWhereInput
}


/**
 * Keystore upsert
 */
export type KeystoreUpsertArgs = {
  /**
   * Select specific fields to fetch from the Keystore
  **/
  select?: KeystoreSelect | null
  /**
   * The filter to search for the Keystore to update in case it exists.
  **/
  where: KeystoreWhereUniqueInput
  /**
   * In case the Keystore found by the `where` argument doesn't exist, create a new Keystore with this data.
  **/
  create: KeystoreCreateInput
  /**
   * In case the Keystore was found with the provided `where` argument, update it with this data.
  **/
  update: KeystoreUpdateInput
}


/**
 * Keystore delete
 */
export type KeystoreDeleteArgs = {
  /**
   * Select specific fields to fetch from the Keystore
  **/
  select?: KeystoreSelect | null
  /**
   * Filter which Keystore to delete.
  **/
  where: KeystoreWhereUniqueInput
}


/**
 * Keystore deleteMany
 */
export type KeystoreDeleteManyArgs = {
  where?: KeystoreWhereInput
}


/**
 * Keystore without action
 */
export type KeystoreArgs = {
  /**
   * Select specific fields to fetch from the Keystore
  **/
  select?: KeystoreSelect | null
}



/**
 * Model Config
 */

export type Config = {
  id: string
  networkId: number
  chainId: number
  address: string
  utxoTreeDepth: number
  withdrawalTreeDepth: number
  nullifierTreeDepth: number
  challengePeriod: number
  minimumStake: string
  referenceDepth: number
  maxUtxo: string
  maxWithdrawal: string
  utxoSubTreeDepth: number
  utxoSubTreeSize: number
  withdrawalSubTreeDepth: number
  withdrawalSubTreeSize: number
}


export type AggregateConfig = {
  count: number
  avg: ConfigAvgAggregateOutputType | null
  sum: ConfigSumAggregateOutputType | null
  min: ConfigMinAggregateOutputType | null
  max: ConfigMaxAggregateOutputType | null
}

export type ConfigAvgAggregateOutputType = {
  networkId: number
  chainId: number
  utxoTreeDepth: number
  withdrawalTreeDepth: number
  nullifierTreeDepth: number
  challengePeriod: number
  referenceDepth: number
  utxoSubTreeDepth: number
  utxoSubTreeSize: number
  withdrawalSubTreeDepth: number
  withdrawalSubTreeSize: number
}

export type ConfigSumAggregateOutputType = {
  networkId: number
  chainId: number
  utxoTreeDepth: number
  withdrawalTreeDepth: number
  nullifierTreeDepth: number
  challengePeriod: number
  referenceDepth: number
  utxoSubTreeDepth: number
  utxoSubTreeSize: number
  withdrawalSubTreeDepth: number
  withdrawalSubTreeSize: number
}

export type ConfigMinAggregateOutputType = {
  networkId: number
  chainId: number
  utxoTreeDepth: number
  withdrawalTreeDepth: number
  nullifierTreeDepth: number
  challengePeriod: number
  referenceDepth: number
  utxoSubTreeDepth: number
  utxoSubTreeSize: number
  withdrawalSubTreeDepth: number
  withdrawalSubTreeSize: number
}

export type ConfigMaxAggregateOutputType = {
  networkId: number
  chainId: number
  utxoTreeDepth: number
  withdrawalTreeDepth: number
  nullifierTreeDepth: number
  challengePeriod: number
  referenceDepth: number
  utxoSubTreeDepth: number
  utxoSubTreeSize: number
  withdrawalSubTreeDepth: number
  withdrawalSubTreeSize: number
}


export type ConfigAvgAggregateInputType = {
  networkId?: true
  chainId?: true
  utxoTreeDepth?: true
  withdrawalTreeDepth?: true
  nullifierTreeDepth?: true
  challengePeriod?: true
  referenceDepth?: true
  utxoSubTreeDepth?: true
  utxoSubTreeSize?: true
  withdrawalSubTreeDepth?: true
  withdrawalSubTreeSize?: true
}

export type ConfigSumAggregateInputType = {
  networkId?: true
  chainId?: true
  utxoTreeDepth?: true
  withdrawalTreeDepth?: true
  nullifierTreeDepth?: true
  challengePeriod?: true
  referenceDepth?: true
  utxoSubTreeDepth?: true
  utxoSubTreeSize?: true
  withdrawalSubTreeDepth?: true
  withdrawalSubTreeSize?: true
}

export type ConfigMinAggregateInputType = {
  networkId?: true
  chainId?: true
  utxoTreeDepth?: true
  withdrawalTreeDepth?: true
  nullifierTreeDepth?: true
  challengePeriod?: true
  referenceDepth?: true
  utxoSubTreeDepth?: true
  utxoSubTreeSize?: true
  withdrawalSubTreeDepth?: true
  withdrawalSubTreeSize?: true
}

export type ConfigMaxAggregateInputType = {
  networkId?: true
  chainId?: true
  utxoTreeDepth?: true
  withdrawalTreeDepth?: true
  nullifierTreeDepth?: true
  challengePeriod?: true
  referenceDepth?: true
  utxoSubTreeDepth?: true
  utxoSubTreeSize?: true
  withdrawalSubTreeDepth?: true
  withdrawalSubTreeSize?: true
}

export type AggregateConfigArgs = {
  where?: ConfigWhereInput
  orderBy?: Enumerable<ConfigOrderByInput>
  cursor?: ConfigWhereUniqueInput
  take?: number
  skip?: number
  distinct?: Enumerable<ConfigDistinctFieldEnum>
  count?: true
  avg?: ConfigAvgAggregateInputType
  sum?: ConfigSumAggregateInputType
  min?: ConfigMinAggregateInputType
  max?: ConfigMaxAggregateInputType
}

export type GetConfigAggregateType<T extends AggregateConfigArgs> = {
  [P in keyof T]: P extends 'count' ? number : GetConfigAggregateScalarType<T[P]>
}

export type GetConfigAggregateScalarType<T extends any> = {
  [P in keyof T]: P extends keyof ConfigAvgAggregateOutputType ? ConfigAvgAggregateOutputType[P] : never
}
    
    

export type ConfigSelect = {
  id?: boolean
  networkId?: boolean
  chainId?: boolean
  address?: boolean
  utxoTreeDepth?: boolean
  withdrawalTreeDepth?: boolean
  nullifierTreeDepth?: boolean
  challengePeriod?: boolean
  minimumStake?: boolean
  referenceDepth?: boolean
  maxUtxo?: boolean
  maxWithdrawal?: boolean
  utxoSubTreeDepth?: boolean
  utxoSubTreeSize?: boolean
  withdrawalSubTreeDepth?: boolean
  withdrawalSubTreeSize?: boolean
}

export type ConfigGetPayload<
  S extends boolean | null | undefined | ConfigArgs,
  U = keyof S
> = S extends true
  ? Config
  : S extends undefined
  ? never
  : S extends ConfigArgs | FindManyConfigArgs
  ? 'include' extends U
    ? Config 
  : 'select' extends U
    ? {
      [P in TrueKeys<S['select']>]:P extends keyof Config ? Config[P]
: 
 never
    }
  : Config
: Config


export interface ConfigDelegate {
  /**
   * Find zero or one Config.
   * @param {FindOneConfigArgs} args - Arguments to find a Config
   * @example
   * // Get one Config
   * const config = await prisma.config.findOne({
   *   where: {
   *     // ... provide filter here
   *   }
   * })
  **/
  findOne<T extends FindOneConfigArgs>(
    args: Subset<T, FindOneConfigArgs>
  ): CheckSelect<T, Prisma__ConfigClient<Config | null>, Prisma__ConfigClient<ConfigGetPayload<T> | null>>
  /**
   * Find zero or more Configs.
   * @param {FindManyConfigArgs=} args - Arguments to filter and select certain fields only.
   * @example
   * // Get all Configs
   * const configs = await prisma.config.findMany()
   * 
   * // Get first 10 Configs
   * const configs = await prisma.config.findMany({ take: 10 })
   * 
   * // Only select the `id`
   * const configWithIdOnly = await prisma.config.findMany({ select: { id: true } })
   * 
  **/
  findMany<T extends FindManyConfigArgs>(
    args?: Subset<T, FindManyConfigArgs>
  ): CheckSelect<T, Promise<Array<Config>>, Promise<Array<ConfigGetPayload<T>>>>
  /**
   * Create a Config.
   * @param {ConfigCreateArgs} args - Arguments to create a Config.
   * @example
   * // Create one Config
   * const Config = await prisma.config.create({
   *   data: {
   *     // ... data to create a Config
   *   }
   * })
   * 
  **/
  create<T extends ConfigCreateArgs>(
    args: Subset<T, ConfigCreateArgs>
  ): CheckSelect<T, Prisma__ConfigClient<Config>, Prisma__ConfigClient<ConfigGetPayload<T>>>
  /**
   * Delete a Config.
   * @param {ConfigDeleteArgs} args - Arguments to delete one Config.
   * @example
   * // Delete one Config
   * const Config = await prisma.config.delete({
   *   where: {
   *     // ... filter to delete one Config
   *   }
   * })
   * 
  **/
  delete<T extends ConfigDeleteArgs>(
    args: Subset<T, ConfigDeleteArgs>
  ): CheckSelect<T, Prisma__ConfigClient<Config>, Prisma__ConfigClient<ConfigGetPayload<T>>>
  /**
   * Update one Config.
   * @param {ConfigUpdateArgs} args - Arguments to update one Config.
   * @example
   * // Update one Config
   * const config = await prisma.config.update({
   *   where: {
   *     // ... provide filter here
   *   },
   *   data: {
   *     // ... provide data here
   *   }
   * })
   * 
  **/
  update<T extends ConfigUpdateArgs>(
    args: Subset<T, ConfigUpdateArgs>
  ): CheckSelect<T, Prisma__ConfigClient<Config>, Prisma__ConfigClient<ConfigGetPayload<T>>>
  /**
   * Delete zero or more Configs.
   * @param {ConfigDeleteManyArgs} args - Arguments to filter Configs to delete.
   * @example
   * // Delete a few Configs
   * const { count } = await prisma.config.deleteMany({
   *   where: {
   *     // ... provide filter here
   *   }
   * })
   * 
  **/
  deleteMany<T extends ConfigDeleteManyArgs>(
    args: Subset<T, ConfigDeleteManyArgs>
  ): Promise<BatchPayload>
  /**
   * Update zero or more Configs.
   * @param {ConfigUpdateManyArgs} args - Arguments to update one or more rows.
   * @example
   * // Update many Configs
   * const config = await prisma.config.updateMany({
   *   where: {
   *     // ... provide filter here
   *   },
   *   data: {
   *     // ... provide data here
   *   }
   * })
   * 
  **/
  updateMany<T extends ConfigUpdateManyArgs>(
    args: Subset<T, ConfigUpdateManyArgs>
  ): Promise<BatchPayload>
  /**
   * Create or update one Config.
   * @param {ConfigUpsertArgs} args - Arguments to update or create a Config.
   * @example
   * // Update or create a Config
   * const config = await prisma.config.upsert({
   *   create: {
   *     // ... data to create a Config
   *   },
   *   update: {
   *     // ... in case it already exists, update
   *   },
   *   where: {
   *     // ... the filter for the Config we want to update
   *   }
   * })
  **/
  upsert<T extends ConfigUpsertArgs>(
    args: Subset<T, ConfigUpsertArgs>
  ): CheckSelect<T, Prisma__ConfigClient<Config>, Prisma__ConfigClient<ConfigGetPayload<T>>>
  /**
   * Count
   */
  count(args?: Omit<FindManyConfigArgs, 'select' | 'include'>): Promise<number>

  /**
   * Aggregate
   */
  aggregate<T extends AggregateConfigArgs>(args: Subset<T, AggregateConfigArgs>): Promise<GetConfigAggregateType<T>>
}

/**
 * The delegate class that acts as a "Promise-like" for Config.
 * Why is this prefixed with `Prisma__`?
 * Because we want to prevent naming conflicts as mentioned in 
 * https://github.com/prisma/prisma-client-js/issues/707
 */
export declare class Prisma__ConfigClient<T> implements Promise<T> {
  private readonly _dmmf;
  private readonly _fetcher;
  private readonly _queryType;
  private readonly _rootField;
  private readonly _clientMethod;
  private readonly _args;
  private readonly _dataPath;
  private readonly _errorFormat;
  private readonly _measurePerformance?;
  private _isList;
  private _callsite;
  private _requestPromise?;
  constructor(_dmmf: DMMFClass, _fetcher: PrismaClientFetcher, _queryType: 'query' | 'mutation', _rootField: string, _clientMethod: string, _args: any, _dataPath: string[], _errorFormat: ErrorFormat, _measurePerformance?: boolean | undefined, _isList?: boolean);
  readonly [Symbol.toStringTag]: 'PrismaClientPromise';


  private get _document();
  /**
   * Attaches callbacks for the resolution and/or rejection of the Promise.
   * @param onfulfilled The callback to execute when the Promise is resolved.
   * @param onrejected The callback to execute when the Promise is rejected.
   * @returns A Promise for the completion of which ever callback is executed.
   */
  then<TResult1 = T, TResult2 = never>(onfulfilled?: ((value: T) => TResult1 | Promise<TResult1>) | undefined | null, onrejected?: ((reason: any) => TResult2 | Promise<TResult2>) | undefined | null): Promise<TResult1 | TResult2>;
  /**
   * Attaches a callback for only the rejection of the Promise.
   * @param onrejected The callback to execute when the Promise is rejected.
   * @returns A Promise for the completion of the callback.
   */
  catch<TResult = never>(onrejected?: ((reason: any) => TResult | Promise<TResult>) | undefined | null): Promise<T | TResult>;
  /**
   * Attaches a callback that is invoked when the Promise is settled (fulfilled or rejected). The
   * resolved value cannot be modified from the callback.
   * @param onfinally The callback to execute when the Promise is settled (fulfilled or rejected).
   * @returns A Promise for the completion of the callback.
   */
  finally(onfinally?: (() => void) | undefined | null): Promise<T>;
}

// Custom InputTypes

/**
 * Config findOne
 */
export type FindOneConfigArgs = {
  /**
   * Select specific fields to fetch from the Config
  **/
  select?: ConfigSelect | null
  /**
   * Filter, which Config to fetch.
  **/
  where: ConfigWhereUniqueInput
}


/**
 * Config findMany
 */
export type FindManyConfigArgs = {
  /**
   * Select specific fields to fetch from the Config
  **/
  select?: ConfigSelect | null
  /**
   * Filter, which Configs to fetch.
  **/
  where?: ConfigWhereInput
  /**
   * Determine the order of the Configs to fetch.
  **/
  orderBy?: Enumerable<ConfigOrderByInput>
  /**
   * Sets the position for listing Configs.
  **/
  cursor?: ConfigWhereUniqueInput
  /**
   * The number of Configs to fetch. If negative number, it will take Configs before the `cursor`.
  **/
  take?: number
  /**
   * Skip the first `n` Configs.
  **/
  skip?: number
  distinct?: Enumerable<ConfigDistinctFieldEnum>
}


/**
 * Config create
 */
export type ConfigCreateArgs = {
  /**
   * Select specific fields to fetch from the Config
  **/
  select?: ConfigSelect | null
  /**
   * The data needed to create a Config.
  **/
  data: ConfigCreateInput
}


/**
 * Config update
 */
export type ConfigUpdateArgs = {
  /**
   * Select specific fields to fetch from the Config
  **/
  select?: ConfigSelect | null
  /**
   * The data needed to update a Config.
  **/
  data: ConfigUpdateInput
  /**
   * Choose, which Config to update.
  **/
  where: ConfigWhereUniqueInput
}


/**
 * Config updateMany
 */
export type ConfigUpdateManyArgs = {
  data: ConfigUpdateManyMutationInput
  where?: ConfigWhereInput
}


/**
 * Config upsert
 */
export type ConfigUpsertArgs = {
  /**
   * Select specific fields to fetch from the Config
  **/
  select?: ConfigSelect | null
  /**
   * The filter to search for the Config to update in case it exists.
  **/
  where: ConfigWhereUniqueInput
  /**
   * In case the Config found by the `where` argument doesn't exist, create a new Config with this data.
  **/
  create: ConfigCreateInput
  /**
   * In case the Config was found with the provided `where` argument, update it with this data.
  **/
  update: ConfigUpdateInput
}


/**
 * Config delete
 */
export type ConfigDeleteArgs = {
  /**
   * Select specific fields to fetch from the Config
  **/
  select?: ConfigSelect | null
  /**
   * Filter which Config to delete.
  **/
  where: ConfigWhereUniqueInput
}


/**
 * Config deleteMany
 */
export type ConfigDeleteManyArgs = {
  where?: ConfigWhereInput
}


/**
 * Config without action
 */
export type ConfigArgs = {
  /**
   * Select specific fields to fetch from the Config
  **/
  select?: ConfigSelect | null
}



/**
 * Model Tracker
 */

export type Tracker = {
  id: number
  viewer: string | null
  address: string | null
}


export type AggregateTracker = {
  count: number
  avg: TrackerAvgAggregateOutputType | null
  sum: TrackerSumAggregateOutputType | null
  min: TrackerMinAggregateOutputType | null
  max: TrackerMaxAggregateOutputType | null
}

export type TrackerAvgAggregateOutputType = {
  id: number
}

export type TrackerSumAggregateOutputType = {
  id: number
}

export type TrackerMinAggregateOutputType = {
  id: number
}

export type TrackerMaxAggregateOutputType = {
  id: number
}


export type TrackerAvgAggregateInputType = {
  id?: true
}

export type TrackerSumAggregateInputType = {
  id?: true
}

export type TrackerMinAggregateInputType = {
  id?: true
}

export type TrackerMaxAggregateInputType = {
  id?: true
}

export type AggregateTrackerArgs = {
  where?: TrackerWhereInput
  orderBy?: Enumerable<TrackerOrderByInput>
  cursor?: TrackerWhereUniqueInput
  take?: number
  skip?: number
  distinct?: Enumerable<TrackerDistinctFieldEnum>
  count?: true
  avg?: TrackerAvgAggregateInputType
  sum?: TrackerSumAggregateInputType
  min?: TrackerMinAggregateInputType
  max?: TrackerMaxAggregateInputType
}

export type GetTrackerAggregateType<T extends AggregateTrackerArgs> = {
  [P in keyof T]: P extends 'count' ? number : GetTrackerAggregateScalarType<T[P]>
}

export type GetTrackerAggregateScalarType<T extends any> = {
  [P in keyof T]: P extends keyof TrackerAvgAggregateOutputType ? TrackerAvgAggregateOutputType[P] : never
}
    
    

export type TrackerSelect = {
  id?: boolean
  viewer?: boolean
  address?: boolean
}

export type TrackerGetPayload<
  S extends boolean | null | undefined | TrackerArgs,
  U = keyof S
> = S extends true
  ? Tracker
  : S extends undefined
  ? never
  : S extends TrackerArgs | FindManyTrackerArgs
  ? 'include' extends U
    ? Tracker 
  : 'select' extends U
    ? {
      [P in TrueKeys<S['select']>]:P extends keyof Tracker ? Tracker[P]
: 
 never
    }
  : Tracker
: Tracker


export interface TrackerDelegate {
  /**
   * Find zero or one Tracker.
   * @param {FindOneTrackerArgs} args - Arguments to find a Tracker
   * @example
   * // Get one Tracker
   * const tracker = await prisma.tracker.findOne({
   *   where: {
   *     // ... provide filter here
   *   }
   * })
  **/
  findOne<T extends FindOneTrackerArgs>(
    args: Subset<T, FindOneTrackerArgs>
  ): CheckSelect<T, Prisma__TrackerClient<Tracker | null>, Prisma__TrackerClient<TrackerGetPayload<T> | null>>
  /**
   * Find zero or more Trackers.
   * @param {FindManyTrackerArgs=} args - Arguments to filter and select certain fields only.
   * @example
   * // Get all Trackers
   * const trackers = await prisma.tracker.findMany()
   * 
   * // Get first 10 Trackers
   * const trackers = await prisma.tracker.findMany({ take: 10 })
   * 
   * // Only select the `id`
   * const trackerWithIdOnly = await prisma.tracker.findMany({ select: { id: true } })
   * 
  **/
  findMany<T extends FindManyTrackerArgs>(
    args?: Subset<T, FindManyTrackerArgs>
  ): CheckSelect<T, Promise<Array<Tracker>>, Promise<Array<TrackerGetPayload<T>>>>
  /**
   * Create a Tracker.
   * @param {TrackerCreateArgs} args - Arguments to create a Tracker.
   * @example
   * // Create one Tracker
   * const Tracker = await prisma.tracker.create({
   *   data: {
   *     // ... data to create a Tracker
   *   }
   * })
   * 
  **/
  create<T extends TrackerCreateArgs>(
    args: Subset<T, TrackerCreateArgs>
  ): CheckSelect<T, Prisma__TrackerClient<Tracker>, Prisma__TrackerClient<TrackerGetPayload<T>>>
  /**
   * Delete a Tracker.
   * @param {TrackerDeleteArgs} args - Arguments to delete one Tracker.
   * @example
   * // Delete one Tracker
   * const Tracker = await prisma.tracker.delete({
   *   where: {
   *     // ... filter to delete one Tracker
   *   }
   * })
   * 
  **/
  delete<T extends TrackerDeleteArgs>(
    args: Subset<T, TrackerDeleteArgs>
  ): CheckSelect<T, Prisma__TrackerClient<Tracker>, Prisma__TrackerClient<TrackerGetPayload<T>>>
  /**
   * Update one Tracker.
   * @param {TrackerUpdateArgs} args - Arguments to update one Tracker.
   * @example
   * // Update one Tracker
   * const tracker = await prisma.tracker.update({
   *   where: {
   *     // ... provide filter here
   *   },
   *   data: {
   *     // ... provide data here
   *   }
   * })
   * 
  **/
  update<T extends TrackerUpdateArgs>(
    args: Subset<T, TrackerUpdateArgs>
  ): CheckSelect<T, Prisma__TrackerClient<Tracker>, Prisma__TrackerClient<TrackerGetPayload<T>>>
  /**
   * Delete zero or more Trackers.
   * @param {TrackerDeleteManyArgs} args - Arguments to filter Trackers to delete.
   * @example
   * // Delete a few Trackers
   * const { count } = await prisma.tracker.deleteMany({
   *   where: {
   *     // ... provide filter here
   *   }
   * })
   * 
  **/
  deleteMany<T extends TrackerDeleteManyArgs>(
    args: Subset<T, TrackerDeleteManyArgs>
  ): Promise<BatchPayload>
  /**
   * Update zero or more Trackers.
   * @param {TrackerUpdateManyArgs} args - Arguments to update one or more rows.
   * @example
   * // Update many Trackers
   * const tracker = await prisma.tracker.updateMany({
   *   where: {
   *     // ... provide filter here
   *   },
   *   data: {
   *     // ... provide data here
   *   }
   * })
   * 
  **/
  updateMany<T extends TrackerUpdateManyArgs>(
    args: Subset<T, TrackerUpdateManyArgs>
  ): Promise<BatchPayload>
  /**
   * Create or update one Tracker.
   * @param {TrackerUpsertArgs} args - Arguments to update or create a Tracker.
   * @example
   * // Update or create a Tracker
   * const tracker = await prisma.tracker.upsert({
   *   create: {
   *     // ... data to create a Tracker
   *   },
   *   update: {
   *     // ... in case it already exists, update
   *   },
   *   where: {
   *     // ... the filter for the Tracker we want to update
   *   }
   * })
  **/
  upsert<T extends TrackerUpsertArgs>(
    args: Subset<T, TrackerUpsertArgs>
  ): CheckSelect<T, Prisma__TrackerClient<Tracker>, Prisma__TrackerClient<TrackerGetPayload<T>>>
  /**
   * Count
   */
  count(args?: Omit<FindManyTrackerArgs, 'select' | 'include'>): Promise<number>

  /**
   * Aggregate
   */
  aggregate<T extends AggregateTrackerArgs>(args: Subset<T, AggregateTrackerArgs>): Promise<GetTrackerAggregateType<T>>
}

/**
 * The delegate class that acts as a "Promise-like" for Tracker.
 * Why is this prefixed with `Prisma__`?
 * Because we want to prevent naming conflicts as mentioned in 
 * https://github.com/prisma/prisma-client-js/issues/707
 */
export declare class Prisma__TrackerClient<T> implements Promise<T> {
  private readonly _dmmf;
  private readonly _fetcher;
  private readonly _queryType;
  private readonly _rootField;
  private readonly _clientMethod;
  private readonly _args;
  private readonly _dataPath;
  private readonly _errorFormat;
  private readonly _measurePerformance?;
  private _isList;
  private _callsite;
  private _requestPromise?;
  constructor(_dmmf: DMMFClass, _fetcher: PrismaClientFetcher, _queryType: 'query' | 'mutation', _rootField: string, _clientMethod: string, _args: any, _dataPath: string[], _errorFormat: ErrorFormat, _measurePerformance?: boolean | undefined, _isList?: boolean);
  readonly [Symbol.toStringTag]: 'PrismaClientPromise';


  private get _document();
  /**
   * Attaches callbacks for the resolution and/or rejection of the Promise.
   * @param onfulfilled The callback to execute when the Promise is resolved.
   * @param onrejected The callback to execute when the Promise is rejected.
   * @returns A Promise for the completion of which ever callback is executed.
   */
  then<TResult1 = T, TResult2 = never>(onfulfilled?: ((value: T) => TResult1 | Promise<TResult1>) | undefined | null, onrejected?: ((reason: any) => TResult2 | Promise<TResult2>) | undefined | null): Promise<TResult1 | TResult2>;
  /**
   * Attaches a callback for only the rejection of the Promise.
   * @param onrejected The callback to execute when the Promise is rejected.
   * @returns A Promise for the completion of the callback.
   */
  catch<TResult = never>(onrejected?: ((reason: any) => TResult | Promise<TResult>) | undefined | null): Promise<T | TResult>;
  /**
   * Attaches a callback that is invoked when the Promise is settled (fulfilled or rejected). The
   * resolved value cannot be modified from the callback.
   * @param onfinally The callback to execute when the Promise is settled (fulfilled or rejected).
   * @returns A Promise for the completion of the callback.
   */
  finally(onfinally?: (() => void) | undefined | null): Promise<T>;
}

// Custom InputTypes

/**
 * Tracker findOne
 */
export type FindOneTrackerArgs = {
  /**
   * Select specific fields to fetch from the Tracker
  **/
  select?: TrackerSelect | null
  /**
   * Filter, which Tracker to fetch.
  **/
  where: TrackerWhereUniqueInput
}


/**
 * Tracker findMany
 */
export type FindManyTrackerArgs = {
  /**
   * Select specific fields to fetch from the Tracker
  **/
  select?: TrackerSelect | null
  /**
   * Filter, which Trackers to fetch.
  **/
  where?: TrackerWhereInput
  /**
   * Determine the order of the Trackers to fetch.
  **/
  orderBy?: Enumerable<TrackerOrderByInput>
  /**
   * Sets the position for listing Trackers.
  **/
  cursor?: TrackerWhereUniqueInput
  /**
   * The number of Trackers to fetch. If negative number, it will take Trackers before the `cursor`.
  **/
  take?: number
  /**
   * Skip the first `n` Trackers.
  **/
  skip?: number
  distinct?: Enumerable<TrackerDistinctFieldEnum>
}


/**
 * Tracker create
 */
export type TrackerCreateArgs = {
  /**
   * Select specific fields to fetch from the Tracker
  **/
  select?: TrackerSelect | null
  /**
   * The data needed to create a Tracker.
  **/
  data: TrackerCreateInput
}


/**
 * Tracker update
 */
export type TrackerUpdateArgs = {
  /**
   * Select specific fields to fetch from the Tracker
  **/
  select?: TrackerSelect | null
  /**
   * The data needed to update a Tracker.
  **/
  data: TrackerUpdateInput
  /**
   * Choose, which Tracker to update.
  **/
  where: TrackerWhereUniqueInput
}


/**
 * Tracker updateMany
 */
export type TrackerUpdateManyArgs = {
  data: TrackerUpdateManyMutationInput
  where?: TrackerWhereInput
}


/**
 * Tracker upsert
 */
export type TrackerUpsertArgs = {
  /**
   * Select specific fields to fetch from the Tracker
  **/
  select?: TrackerSelect | null
  /**
   * The filter to search for the Tracker to update in case it exists.
  **/
  where: TrackerWhereUniqueInput
  /**
   * In case the Tracker found by the `where` argument doesn't exist, create a new Tracker with this data.
  **/
  create: TrackerCreateInput
  /**
   * In case the Tracker was found with the provided `where` argument, update it with this data.
  **/
  update: TrackerUpdateInput
}


/**
 * Tracker delete
 */
export type TrackerDeleteArgs = {
  /**
   * Select specific fields to fetch from the Tracker
  **/
  select?: TrackerSelect | null
  /**
   * Filter which Tracker to delete.
  **/
  where: TrackerWhereUniqueInput
}


/**
 * Tracker deleteMany
 */
export type TrackerDeleteManyArgs = {
  where?: TrackerWhereInput
}


/**
 * Tracker without action
 */
export type TrackerArgs = {
  /**
   * Select specific fields to fetch from the Tracker
  **/
  select?: TrackerSelect | null
}



/**
 * Model Proposal
 */

export type Proposal = {
  hash: string
  proposalNum: number | null
  proposedAt: number | null
  proposalTx: string | null
  proposalData: string | null
  fetched: string | null
  finalized: boolean | null
  verified: boolean | null
  isUncle: boolean | null
}


export type AggregateProposal = {
  count: number
  avg: ProposalAvgAggregateOutputType | null
  sum: ProposalSumAggregateOutputType | null
  min: ProposalMinAggregateOutputType | null
  max: ProposalMaxAggregateOutputType | null
}

export type ProposalAvgAggregateOutputType = {
  proposalNum: number
  proposedAt: number
}

export type ProposalSumAggregateOutputType = {
  proposalNum: number | null
  proposedAt: number | null
}

export type ProposalMinAggregateOutputType = {
  proposalNum: number | null
  proposedAt: number | null
}

export type ProposalMaxAggregateOutputType = {
  proposalNum: number | null
  proposedAt: number | null
}


export type ProposalAvgAggregateInputType = {
  proposalNum?: true
  proposedAt?: true
}

export type ProposalSumAggregateInputType = {
  proposalNum?: true
  proposedAt?: true
}

export type ProposalMinAggregateInputType = {
  proposalNum?: true
  proposedAt?: true
}

export type ProposalMaxAggregateInputType = {
  proposalNum?: true
  proposedAt?: true
}

export type AggregateProposalArgs = {
  where?: ProposalWhereInput
  orderBy?: Enumerable<ProposalOrderByInput>
  cursor?: ProposalWhereUniqueInput
  take?: number
  skip?: number
  distinct?: Enumerable<ProposalDistinctFieldEnum>
  count?: true
  avg?: ProposalAvgAggregateInputType
  sum?: ProposalSumAggregateInputType
  min?: ProposalMinAggregateInputType
  max?: ProposalMaxAggregateInputType
}

export type GetProposalAggregateType<T extends AggregateProposalArgs> = {
  [P in keyof T]: P extends 'count' ? number : GetProposalAggregateScalarType<T[P]>
}

export type GetProposalAggregateScalarType<T extends any> = {
  [P in keyof T]: P extends keyof ProposalAvgAggregateOutputType ? ProposalAvgAggregateOutputType[P] : never
}
    
    

export type ProposalSelect = {
  hash?: boolean
  proposalNum?: boolean
  proposedAt?: boolean
  proposalTx?: boolean
  proposalData?: boolean
  fetched?: boolean
  finalized?: boolean
  verified?: boolean
  isUncle?: boolean
  block?: boolean | BlockArgs
}

export type ProposalInclude = {
  block?: boolean | BlockArgs
}

export type ProposalGetPayload<
  S extends boolean | null | undefined | ProposalArgs,
  U = keyof S
> = S extends true
  ? Proposal
  : S extends undefined
  ? never
  : S extends ProposalArgs | FindManyProposalArgs
  ? 'include' extends U
    ? Proposal  & {
      [P in TrueKeys<S['include']>]:
      P extends 'block'
      ? BlockGetPayload<S['include'][P]> | null : never
    }
  : 'select' extends U
    ? {
      [P in TrueKeys<S['select']>]:P extends keyof Proposal ? Proposal[P]
: 
      P extends 'block'
      ? BlockGetPayload<S['select'][P]> | null : never
    }
  : Proposal
: Proposal


export interface ProposalDelegate {
  /**
   * Find zero or one Proposal.
   * @param {FindOneProposalArgs} args - Arguments to find a Proposal
   * @example
   * // Get one Proposal
   * const proposal = await prisma.proposal.findOne({
   *   where: {
   *     // ... provide filter here
   *   }
   * })
  **/
  findOne<T extends FindOneProposalArgs>(
    args: Subset<T, FindOneProposalArgs>
  ): CheckSelect<T, Prisma__ProposalClient<Proposal | null>, Prisma__ProposalClient<ProposalGetPayload<T> | null>>
  /**
   * Find zero or more Proposals.
   * @param {FindManyProposalArgs=} args - Arguments to filter and select certain fields only.
   * @example
   * // Get all Proposals
   * const proposals = await prisma.proposal.findMany()
   * 
   * // Get first 10 Proposals
   * const proposals = await prisma.proposal.findMany({ take: 10 })
   * 
   * // Only select the `hash`
   * const proposalWithHashOnly = await prisma.proposal.findMany({ select: { hash: true } })
   * 
  **/
  findMany<T extends FindManyProposalArgs>(
    args?: Subset<T, FindManyProposalArgs>
  ): CheckSelect<T, Promise<Array<Proposal>>, Promise<Array<ProposalGetPayload<T>>>>
  /**
   * Create a Proposal.
   * @param {ProposalCreateArgs} args - Arguments to create a Proposal.
   * @example
   * // Create one Proposal
   * const Proposal = await prisma.proposal.create({
   *   data: {
   *     // ... data to create a Proposal
   *   }
   * })
   * 
  **/
  create<T extends ProposalCreateArgs>(
    args: Subset<T, ProposalCreateArgs>
  ): CheckSelect<T, Prisma__ProposalClient<Proposal>, Prisma__ProposalClient<ProposalGetPayload<T>>>
  /**
   * Delete a Proposal.
   * @param {ProposalDeleteArgs} args - Arguments to delete one Proposal.
   * @example
   * // Delete one Proposal
   * const Proposal = await prisma.proposal.delete({
   *   where: {
   *     // ... filter to delete one Proposal
   *   }
   * })
   * 
  **/
  delete<T extends ProposalDeleteArgs>(
    args: Subset<T, ProposalDeleteArgs>
  ): CheckSelect<T, Prisma__ProposalClient<Proposal>, Prisma__ProposalClient<ProposalGetPayload<T>>>
  /**
   * Update one Proposal.
   * @param {ProposalUpdateArgs} args - Arguments to update one Proposal.
   * @example
   * // Update one Proposal
   * const proposal = await prisma.proposal.update({
   *   where: {
   *     // ... provide filter here
   *   },
   *   data: {
   *     // ... provide data here
   *   }
   * })
   * 
  **/
  update<T extends ProposalUpdateArgs>(
    args: Subset<T, ProposalUpdateArgs>
  ): CheckSelect<T, Prisma__ProposalClient<Proposal>, Prisma__ProposalClient<ProposalGetPayload<T>>>
  /**
   * Delete zero or more Proposals.
   * @param {ProposalDeleteManyArgs} args - Arguments to filter Proposals to delete.
   * @example
   * // Delete a few Proposals
   * const { count } = await prisma.proposal.deleteMany({
   *   where: {
   *     // ... provide filter here
   *   }
   * })
   * 
  **/
  deleteMany<T extends ProposalDeleteManyArgs>(
    args: Subset<T, ProposalDeleteManyArgs>
  ): Promise<BatchPayload>
  /**
   * Update zero or more Proposals.
   * @param {ProposalUpdateManyArgs} args - Arguments to update one or more rows.
   * @example
   * // Update many Proposals
   * const proposal = await prisma.proposal.updateMany({
   *   where: {
   *     // ... provide filter here
   *   },
   *   data: {
   *     // ... provide data here
   *   }
   * })
   * 
  **/
  updateMany<T extends ProposalUpdateManyArgs>(
    args: Subset<T, ProposalUpdateManyArgs>
  ): Promise<BatchPayload>
  /**
   * Create or update one Proposal.
   * @param {ProposalUpsertArgs} args - Arguments to update or create a Proposal.
   * @example
   * // Update or create a Proposal
   * const proposal = await prisma.proposal.upsert({
   *   create: {
   *     // ... data to create a Proposal
   *   },
   *   update: {
   *     // ... in case it already exists, update
   *   },
   *   where: {
   *     // ... the filter for the Proposal we want to update
   *   }
   * })
  **/
  upsert<T extends ProposalUpsertArgs>(
    args: Subset<T, ProposalUpsertArgs>
  ): CheckSelect<T, Prisma__ProposalClient<Proposal>, Prisma__ProposalClient<ProposalGetPayload<T>>>
  /**
   * Count
   */
  count(args?: Omit<FindManyProposalArgs, 'select' | 'include'>): Promise<number>

  /**
   * Aggregate
   */
  aggregate<T extends AggregateProposalArgs>(args: Subset<T, AggregateProposalArgs>): Promise<GetProposalAggregateType<T>>
}

/**
 * The delegate class that acts as a "Promise-like" for Proposal.
 * Why is this prefixed with `Prisma__`?
 * Because we want to prevent naming conflicts as mentioned in 
 * https://github.com/prisma/prisma-client-js/issues/707
 */
export declare class Prisma__ProposalClient<T> implements Promise<T> {
  private readonly _dmmf;
  private readonly _fetcher;
  private readonly _queryType;
  private readonly _rootField;
  private readonly _clientMethod;
  private readonly _args;
  private readonly _dataPath;
  private readonly _errorFormat;
  private readonly _measurePerformance?;
  private _isList;
  private _callsite;
  private _requestPromise?;
  constructor(_dmmf: DMMFClass, _fetcher: PrismaClientFetcher, _queryType: 'query' | 'mutation', _rootField: string, _clientMethod: string, _args: any, _dataPath: string[], _errorFormat: ErrorFormat, _measurePerformance?: boolean | undefined, _isList?: boolean);
  readonly [Symbol.toStringTag]: 'PrismaClientPromise';

  block<T extends BlockArgs = {}>(args?: Subset<T, BlockArgs>): CheckSelect<T, Prisma__BlockClient<Block | null>, Prisma__BlockClient<BlockGetPayload<T> | null>>;

  private get _document();
  /**
   * Attaches callbacks for the resolution and/or rejection of the Promise.
   * @param onfulfilled The callback to execute when the Promise is resolved.
   * @param onrejected The callback to execute when the Promise is rejected.
   * @returns A Promise for the completion of which ever callback is executed.
   */
  then<TResult1 = T, TResult2 = never>(onfulfilled?: ((value: T) => TResult1 | Promise<TResult1>) | undefined | null, onrejected?: ((reason: any) => TResult2 | Promise<TResult2>) | undefined | null): Promise<TResult1 | TResult2>;
  /**
   * Attaches a callback for only the rejection of the Promise.
   * @param onrejected The callback to execute when the Promise is rejected.
   * @returns A Promise for the completion of the callback.
   */
  catch<TResult = never>(onrejected?: ((reason: any) => TResult | Promise<TResult>) | undefined | null): Promise<T | TResult>;
  /**
   * Attaches a callback that is invoked when the Promise is settled (fulfilled or rejected). The
   * resolved value cannot be modified from the callback.
   * @param onfinally The callback to execute when the Promise is settled (fulfilled or rejected).
   * @returns A Promise for the completion of the callback.
   */
  finally(onfinally?: (() => void) | undefined | null): Promise<T>;
}

// Custom InputTypes

/**
 * Proposal findOne
 */
export type FindOneProposalArgs = {
  /**
   * Select specific fields to fetch from the Proposal
  **/
  select?: ProposalSelect | null
  /**
   * Choose, which related nodes to fetch as well.
  **/
  include?: ProposalInclude | null
  /**
   * Filter, which Proposal to fetch.
  **/
  where: ProposalWhereUniqueInput
}


/**
 * Proposal findMany
 */
export type FindManyProposalArgs = {
  /**
   * Select specific fields to fetch from the Proposal
  **/
  select?: ProposalSelect | null
  /**
   * Choose, which related nodes to fetch as well.
  **/
  include?: ProposalInclude | null
  /**
   * Filter, which Proposals to fetch.
  **/
  where?: ProposalWhereInput
  /**
   * Determine the order of the Proposals to fetch.
  **/
  orderBy?: Enumerable<ProposalOrderByInput>
  /**
   * Sets the position for listing Proposals.
  **/
  cursor?: ProposalWhereUniqueInput
  /**
   * The number of Proposals to fetch. If negative number, it will take Proposals before the `cursor`.
  **/
  take?: number
  /**
   * Skip the first `n` Proposals.
  **/
  skip?: number
  distinct?: Enumerable<ProposalDistinctFieldEnum>
}


/**
 * Proposal create
 */
export type ProposalCreateArgs = {
  /**
   * Select specific fields to fetch from the Proposal
  **/
  select?: ProposalSelect | null
  /**
   * Choose, which related nodes to fetch as well.
  **/
  include?: ProposalInclude | null
  /**
   * The data needed to create a Proposal.
  **/
  data: ProposalCreateInput
}


/**
 * Proposal update
 */
export type ProposalUpdateArgs = {
  /**
   * Select specific fields to fetch from the Proposal
  **/
  select?: ProposalSelect | null
  /**
   * Choose, which related nodes to fetch as well.
  **/
  include?: ProposalInclude | null
  /**
   * The data needed to update a Proposal.
  **/
  data: ProposalUpdateInput
  /**
   * Choose, which Proposal to update.
  **/
  where: ProposalWhereUniqueInput
}


/**
 * Proposal updateMany
 */
export type ProposalUpdateManyArgs = {
  data: ProposalUpdateManyMutationInput
  where?: ProposalWhereInput
}


/**
 * Proposal upsert
 */
export type ProposalUpsertArgs = {
  /**
   * Select specific fields to fetch from the Proposal
  **/
  select?: ProposalSelect | null
  /**
   * Choose, which related nodes to fetch as well.
  **/
  include?: ProposalInclude | null
  /**
   * The filter to search for the Proposal to update in case it exists.
  **/
  where: ProposalWhereUniqueInput
  /**
   * In case the Proposal found by the `where` argument doesn't exist, create a new Proposal with this data.
  **/
  create: ProposalCreateInput
  /**
   * In case the Proposal was found with the provided `where` argument, update it with this data.
  **/
  update: ProposalUpdateInput
}


/**
 * Proposal delete
 */
export type ProposalDeleteArgs = {
  /**
   * Select specific fields to fetch from the Proposal
  **/
  select?: ProposalSelect | null
  /**
   * Choose, which related nodes to fetch as well.
  **/
  include?: ProposalInclude | null
  /**
   * Filter which Proposal to delete.
  **/
  where: ProposalWhereUniqueInput
}


/**
 * Proposal deleteMany
 */
export type ProposalDeleteManyArgs = {
  where?: ProposalWhereInput
}


/**
 * Proposal without action
 */
export type ProposalArgs = {
  /**
   * Select specific fields to fetch from the Proposal
  **/
  select?: ProposalSelect | null
  /**
   * Choose, which related nodes to fetch as well.
  **/
  include?: ProposalInclude | null
}



/**
 * Model Block
 */

export type Block = {
  hash: string
}


export type AggregateBlock = {
  count: number
}



export type AggregateBlockArgs = {
  where?: BlockWhereInput
  orderBy?: Enumerable<BlockOrderByInput>
  cursor?: BlockWhereUniqueInput
  take?: number
  skip?: number
  distinct?: Enumerable<BlockDistinctFieldEnum>
  count?: true
}

export type GetBlockAggregateType<T extends AggregateBlockArgs> = {
  [P in keyof T]: P extends 'count' ? number : never
}


    
    

export type BlockSelect = {
  hash?: boolean
  header?: boolean | HeaderArgs
  proposal?: boolean | ProposalArgs
  bootstrap?: boolean | BootstrapArgs
  slash?: boolean | SlashArgs
}

export type BlockInclude = {
  header?: boolean | HeaderArgs
  proposal?: boolean | ProposalArgs
  bootstrap?: boolean | BootstrapArgs
  slash?: boolean | SlashArgs
}

export type BlockGetPayload<
  S extends boolean | null | undefined | BlockArgs,
  U = keyof S
> = S extends true
  ? Block
  : S extends undefined
  ? never
  : S extends BlockArgs | FindManyBlockArgs
  ? 'include' extends U
    ? Block  & {
      [P in TrueKeys<S['include']>]:
      P extends 'header'
      ? HeaderGetPayload<S['include'][P]> :
      P extends 'proposal'
      ? ProposalGetPayload<S['include'][P]> :
      P extends 'bootstrap'
      ? BootstrapGetPayload<S['include'][P]> | null :
      P extends 'slash'
      ? SlashGetPayload<S['include'][P]> | null : never
    }
  : 'select' extends U
    ? {
      [P in TrueKeys<S['select']>]:P extends keyof Block ? Block[P]
: 
      P extends 'header'
      ? HeaderGetPayload<S['select'][P]> :
      P extends 'proposal'
      ? ProposalGetPayload<S['select'][P]> :
      P extends 'bootstrap'
      ? BootstrapGetPayload<S['select'][P]> | null :
      P extends 'slash'
      ? SlashGetPayload<S['select'][P]> | null : never
    }
  : Block
: Block


export interface BlockDelegate {
  /**
   * Find zero or one Block.
   * @param {FindOneBlockArgs} args - Arguments to find a Block
   * @example
   * // Get one Block
   * const block = await prisma.block.findOne({
   *   where: {
   *     // ... provide filter here
   *   }
   * })
  **/
  findOne<T extends FindOneBlockArgs>(
    args: Subset<T, FindOneBlockArgs>
  ): CheckSelect<T, Prisma__BlockClient<Block | null>, Prisma__BlockClient<BlockGetPayload<T> | null>>
  /**
   * Find zero or more Blocks.
   * @param {FindManyBlockArgs=} args - Arguments to filter and select certain fields only.
   * @example
   * // Get all Blocks
   * const blocks = await prisma.block.findMany()
   * 
   * // Get first 10 Blocks
   * const blocks = await prisma.block.findMany({ take: 10 })
   * 
   * // Only select the `hash`
   * const blockWithHashOnly = await prisma.block.findMany({ select: { hash: true } })
   * 
  **/
  findMany<T extends FindManyBlockArgs>(
    args?: Subset<T, FindManyBlockArgs>
  ): CheckSelect<T, Promise<Array<Block>>, Promise<Array<BlockGetPayload<T>>>>
  /**
   * Create a Block.
   * @param {BlockCreateArgs} args - Arguments to create a Block.
   * @example
   * // Create one Block
   * const Block = await prisma.block.create({
   *   data: {
   *     // ... data to create a Block
   *   }
   * })
   * 
  **/
  create<T extends BlockCreateArgs>(
    args: Subset<T, BlockCreateArgs>
  ): CheckSelect<T, Prisma__BlockClient<Block>, Prisma__BlockClient<BlockGetPayload<T>>>
  /**
   * Delete a Block.
   * @param {BlockDeleteArgs} args - Arguments to delete one Block.
   * @example
   * // Delete one Block
   * const Block = await prisma.block.delete({
   *   where: {
   *     // ... filter to delete one Block
   *   }
   * })
   * 
  **/
  delete<T extends BlockDeleteArgs>(
    args: Subset<T, BlockDeleteArgs>
  ): CheckSelect<T, Prisma__BlockClient<Block>, Prisma__BlockClient<BlockGetPayload<T>>>
  /**
   * Update one Block.
   * @param {BlockUpdateArgs} args - Arguments to update one Block.
   * @example
   * // Update one Block
   * const block = await prisma.block.update({
   *   where: {
   *     // ... provide filter here
   *   },
   *   data: {
   *     // ... provide data here
   *   }
   * })
   * 
  **/
  update<T extends BlockUpdateArgs>(
    args: Subset<T, BlockUpdateArgs>
  ): CheckSelect<T, Prisma__BlockClient<Block>, Prisma__BlockClient<BlockGetPayload<T>>>
  /**
   * Delete zero or more Blocks.
   * @param {BlockDeleteManyArgs} args - Arguments to filter Blocks to delete.
   * @example
   * // Delete a few Blocks
   * const { count } = await prisma.block.deleteMany({
   *   where: {
   *     // ... provide filter here
   *   }
   * })
   * 
  **/
  deleteMany<T extends BlockDeleteManyArgs>(
    args: Subset<T, BlockDeleteManyArgs>
  ): Promise<BatchPayload>
  /**
   * Update zero or more Blocks.
   * @param {BlockUpdateManyArgs} args - Arguments to update one or more rows.
   * @example
   * // Update many Blocks
   * const block = await prisma.block.updateMany({
   *   where: {
   *     // ... provide filter here
   *   },
   *   data: {
   *     // ... provide data here
   *   }
   * })
   * 
  **/
  updateMany<T extends BlockUpdateManyArgs>(
    args: Subset<T, BlockUpdateManyArgs>
  ): Promise<BatchPayload>
  /**
   * Create or update one Block.
   * @param {BlockUpsertArgs} args - Arguments to update or create a Block.
   * @example
   * // Update or create a Block
   * const block = await prisma.block.upsert({
   *   create: {
   *     // ... data to create a Block
   *   },
   *   update: {
   *     // ... in case it already exists, update
   *   },
   *   where: {
   *     // ... the filter for the Block we want to update
   *   }
   * })
  **/
  upsert<T extends BlockUpsertArgs>(
    args: Subset<T, BlockUpsertArgs>
  ): CheckSelect<T, Prisma__BlockClient<Block>, Prisma__BlockClient<BlockGetPayload<T>>>
  /**
   * Count
   */
  count(args?: Omit<FindManyBlockArgs, 'select' | 'include'>): Promise<number>

  /**
   * Aggregate
   */
  aggregate<T extends AggregateBlockArgs>(args: Subset<T, AggregateBlockArgs>): Promise<GetBlockAggregateType<T>>
}

/**
 * The delegate class that acts as a "Promise-like" for Block.
 * Why is this prefixed with `Prisma__`?
 * Because we want to prevent naming conflicts as mentioned in 
 * https://github.com/prisma/prisma-client-js/issues/707
 */
export declare class Prisma__BlockClient<T> implements Promise<T> {
  private readonly _dmmf;
  private readonly _fetcher;
  private readonly _queryType;
  private readonly _rootField;
  private readonly _clientMethod;
  private readonly _args;
  private readonly _dataPath;
  private readonly _errorFormat;
  private readonly _measurePerformance?;
  private _isList;
  private _callsite;
  private _requestPromise?;
  constructor(_dmmf: DMMFClass, _fetcher: PrismaClientFetcher, _queryType: 'query' | 'mutation', _rootField: string, _clientMethod: string, _args: any, _dataPath: string[], _errorFormat: ErrorFormat, _measurePerformance?: boolean | undefined, _isList?: boolean);
  readonly [Symbol.toStringTag]: 'PrismaClientPromise';

  header<T extends HeaderArgs = {}>(args?: Subset<T, HeaderArgs>): CheckSelect<T, Prisma__HeaderClient<Header | null>, Prisma__HeaderClient<HeaderGetPayload<T> | null>>;

  proposal<T extends ProposalArgs = {}>(args?: Subset<T, ProposalArgs>): CheckSelect<T, Prisma__ProposalClient<Proposal | null>, Prisma__ProposalClient<ProposalGetPayload<T> | null>>;

  bootstrap<T extends BootstrapArgs = {}>(args?: Subset<T, BootstrapArgs>): CheckSelect<T, Prisma__BootstrapClient<Bootstrap | null>, Prisma__BootstrapClient<BootstrapGetPayload<T> | null>>;

  slash<T extends SlashArgs = {}>(args?: Subset<T, SlashArgs>): CheckSelect<T, Prisma__SlashClient<Slash | null>, Prisma__SlashClient<SlashGetPayload<T> | null>>;

  private get _document();
  /**
   * Attaches callbacks for the resolution and/or rejection of the Promise.
   * @param onfulfilled The callback to execute when the Promise is resolved.
   * @param onrejected The callback to execute when the Promise is rejected.
   * @returns A Promise for the completion of which ever callback is executed.
   */
  then<TResult1 = T, TResult2 = never>(onfulfilled?: ((value: T) => TResult1 | Promise<TResult1>) | undefined | null, onrejected?: ((reason: any) => TResult2 | Promise<TResult2>) | undefined | null): Promise<TResult1 | TResult2>;
  /**
   * Attaches a callback for only the rejection of the Promise.
   * @param onrejected The callback to execute when the Promise is rejected.
   * @returns A Promise for the completion of the callback.
   */
  catch<TResult = never>(onrejected?: ((reason: any) => TResult | Promise<TResult>) | undefined | null): Promise<T | TResult>;
  /**
   * Attaches a callback that is invoked when the Promise is settled (fulfilled or rejected). The
   * resolved value cannot be modified from the callback.
   * @param onfinally The callback to execute when the Promise is settled (fulfilled or rejected).
   * @returns A Promise for the completion of the callback.
   */
  finally(onfinally?: (() => void) | undefined | null): Promise<T>;
}

// Custom InputTypes

/**
 * Block findOne
 */
export type FindOneBlockArgs = {
  /**
   * Select specific fields to fetch from the Block
  **/
  select?: BlockSelect | null
  /**
   * Choose, which related nodes to fetch as well.
  **/
  include?: BlockInclude | null
  /**
   * Filter, which Block to fetch.
  **/
  where: BlockWhereUniqueInput
}


/**
 * Block findMany
 */
export type FindManyBlockArgs = {
  /**
   * Select specific fields to fetch from the Block
  **/
  select?: BlockSelect | null
  /**
   * Choose, which related nodes to fetch as well.
  **/
  include?: BlockInclude | null
  /**
   * Filter, which Blocks to fetch.
  **/
  where?: BlockWhereInput
  /**
   * Determine the order of the Blocks to fetch.
  **/
  orderBy?: Enumerable<BlockOrderByInput>
  /**
   * Sets the position for listing Blocks.
  **/
  cursor?: BlockWhereUniqueInput
  /**
   * The number of Blocks to fetch. If negative number, it will take Blocks before the `cursor`.
  **/
  take?: number
  /**
   * Skip the first `n` Blocks.
  **/
  skip?: number
  distinct?: Enumerable<BlockDistinctFieldEnum>
}


/**
 * Block create
 */
export type BlockCreateArgs = {
  /**
   * Select specific fields to fetch from the Block
  **/
  select?: BlockSelect | null
  /**
   * Choose, which related nodes to fetch as well.
  **/
  include?: BlockInclude | null
  /**
   * The data needed to create a Block.
  **/
  data: BlockCreateInput
}


/**
 * Block update
 */
export type BlockUpdateArgs = {
  /**
   * Select specific fields to fetch from the Block
  **/
  select?: BlockSelect | null
  /**
   * Choose, which related nodes to fetch as well.
  **/
  include?: BlockInclude | null
  /**
   * The data needed to update a Block.
  **/
  data: BlockUpdateInput
  /**
   * Choose, which Block to update.
  **/
  where: BlockWhereUniqueInput
}


/**
 * Block updateMany
 */
export type BlockUpdateManyArgs = {
  data: BlockUpdateManyMutationInput
  where?: BlockWhereInput
}


/**
 * Block upsert
 */
export type BlockUpsertArgs = {
  /**
   * Select specific fields to fetch from the Block
  **/
  select?: BlockSelect | null
  /**
   * Choose, which related nodes to fetch as well.
  **/
  include?: BlockInclude | null
  /**
   * The filter to search for the Block to update in case it exists.
  **/
  where: BlockWhereUniqueInput
  /**
   * In case the Block found by the `where` argument doesn't exist, create a new Block with this data.
  **/
  create: BlockCreateInput
  /**
   * In case the Block was found with the provided `where` argument, update it with this data.
  **/
  update: BlockUpdateInput
}


/**
 * Block delete
 */
export type BlockDeleteArgs = {
  /**
   * Select specific fields to fetch from the Block
  **/
  select?: BlockSelect | null
  /**
   * Choose, which related nodes to fetch as well.
  **/
  include?: BlockInclude | null
  /**
   * Filter which Block to delete.
  **/
  where: BlockWhereUniqueInput
}


/**
 * Block deleteMany
 */
export type BlockDeleteManyArgs = {
  where?: BlockWhereInput
}


/**
 * Block without action
 */
export type BlockArgs = {
  /**
   * Select specific fields to fetch from the Block
  **/
  select?: BlockSelect | null
  /**
   * Choose, which related nodes to fetch as well.
  **/
  include?: BlockInclude | null
}



/**
 * Model Slash
 */

export type Slash = {
  hash: string
  proposer: string
  reason: string
  executionTx: string
  slashedAt: number
}


export type AggregateSlash = {
  count: number
  avg: SlashAvgAggregateOutputType | null
  sum: SlashSumAggregateOutputType | null
  min: SlashMinAggregateOutputType | null
  max: SlashMaxAggregateOutputType | null
}

export type SlashAvgAggregateOutputType = {
  slashedAt: number
}

export type SlashSumAggregateOutputType = {
  slashedAt: number
}

export type SlashMinAggregateOutputType = {
  slashedAt: number
}

export type SlashMaxAggregateOutputType = {
  slashedAt: number
}


export type SlashAvgAggregateInputType = {
  slashedAt?: true
}

export type SlashSumAggregateInputType = {
  slashedAt?: true
}

export type SlashMinAggregateInputType = {
  slashedAt?: true
}

export type SlashMaxAggregateInputType = {
  slashedAt?: true
}

export type AggregateSlashArgs = {
  where?: SlashWhereInput
  orderBy?: Enumerable<SlashOrderByInput>
  cursor?: SlashWhereUniqueInput
  take?: number
  skip?: number
  distinct?: Enumerable<SlashDistinctFieldEnum>
  count?: true
  avg?: SlashAvgAggregateInputType
  sum?: SlashSumAggregateInputType
  min?: SlashMinAggregateInputType
  max?: SlashMaxAggregateInputType
}

export type GetSlashAggregateType<T extends AggregateSlashArgs> = {
  [P in keyof T]: P extends 'count' ? number : GetSlashAggregateScalarType<T[P]>
}

export type GetSlashAggregateScalarType<T extends any> = {
  [P in keyof T]: P extends keyof SlashAvgAggregateOutputType ? SlashAvgAggregateOutputType[P] : never
}
    
    

export type SlashSelect = {
  hash?: boolean
  proposer?: boolean
  reason?: boolean
  executionTx?: boolean
  slashedAt?: boolean
  block?: boolean | BlockArgs
}

export type SlashInclude = {
  block?: boolean | BlockArgs
}

export type SlashGetPayload<
  S extends boolean | null | undefined | SlashArgs,
  U = keyof S
> = S extends true
  ? Slash
  : S extends undefined
  ? never
  : S extends SlashArgs | FindManySlashArgs
  ? 'include' extends U
    ? Slash  & {
      [P in TrueKeys<S['include']>]:
      P extends 'block'
      ? BlockGetPayload<S['include'][P]> : never
    }
  : 'select' extends U
    ? {
      [P in TrueKeys<S['select']>]:P extends keyof Slash ? Slash[P]
: 
      P extends 'block'
      ? BlockGetPayload<S['select'][P]> : never
    }
  : Slash
: Slash


export interface SlashDelegate {
  /**
   * Find zero or one Slash.
   * @param {FindOneSlashArgs} args - Arguments to find a Slash
   * @example
   * // Get one Slash
   * const slash = await prisma.slash.findOne({
   *   where: {
   *     // ... provide filter here
   *   }
   * })
  **/
  findOne<T extends FindOneSlashArgs>(
    args: Subset<T, FindOneSlashArgs>
  ): CheckSelect<T, Prisma__SlashClient<Slash | null>, Prisma__SlashClient<SlashGetPayload<T> | null>>
  /**
   * Find zero or more Slashes.
   * @param {FindManySlashArgs=} args - Arguments to filter and select certain fields only.
   * @example
   * // Get all Slashes
   * const slashes = await prisma.slash.findMany()
   * 
   * // Get first 10 Slashes
   * const slashes = await prisma.slash.findMany({ take: 10 })
   * 
   * // Only select the `hash`
   * const slashWithHashOnly = await prisma.slash.findMany({ select: { hash: true } })
   * 
  **/
  findMany<T extends FindManySlashArgs>(
    args?: Subset<T, FindManySlashArgs>
  ): CheckSelect<T, Promise<Array<Slash>>, Promise<Array<SlashGetPayload<T>>>>
  /**
   * Create a Slash.
   * @param {SlashCreateArgs} args - Arguments to create a Slash.
   * @example
   * // Create one Slash
   * const Slash = await prisma.slash.create({
   *   data: {
   *     // ... data to create a Slash
   *   }
   * })
   * 
  **/
  create<T extends SlashCreateArgs>(
    args: Subset<T, SlashCreateArgs>
  ): CheckSelect<T, Prisma__SlashClient<Slash>, Prisma__SlashClient<SlashGetPayload<T>>>
  /**
   * Delete a Slash.
   * @param {SlashDeleteArgs} args - Arguments to delete one Slash.
   * @example
   * // Delete one Slash
   * const Slash = await prisma.slash.delete({
   *   where: {
   *     // ... filter to delete one Slash
   *   }
   * })
   * 
  **/
  delete<T extends SlashDeleteArgs>(
    args: Subset<T, SlashDeleteArgs>
  ): CheckSelect<T, Prisma__SlashClient<Slash>, Prisma__SlashClient<SlashGetPayload<T>>>
  /**
   * Update one Slash.
   * @param {SlashUpdateArgs} args - Arguments to update one Slash.
   * @example
   * // Update one Slash
   * const slash = await prisma.slash.update({
   *   where: {
   *     // ... provide filter here
   *   },
   *   data: {
   *     // ... provide data here
   *   }
   * })
   * 
  **/
  update<T extends SlashUpdateArgs>(
    args: Subset<T, SlashUpdateArgs>
  ): CheckSelect<T, Prisma__SlashClient<Slash>, Prisma__SlashClient<SlashGetPayload<T>>>
  /**
   * Delete zero or more Slashes.
   * @param {SlashDeleteManyArgs} args - Arguments to filter Slashes to delete.
   * @example
   * // Delete a few Slashes
   * const { count } = await prisma.slash.deleteMany({
   *   where: {
   *     // ... provide filter here
   *   }
   * })
   * 
  **/
  deleteMany<T extends SlashDeleteManyArgs>(
    args: Subset<T, SlashDeleteManyArgs>
  ): Promise<BatchPayload>
  /**
   * Update zero or more Slashes.
   * @param {SlashUpdateManyArgs} args - Arguments to update one or more rows.
   * @example
   * // Update many Slashes
   * const slash = await prisma.slash.updateMany({
   *   where: {
   *     // ... provide filter here
   *   },
   *   data: {
   *     // ... provide data here
   *   }
   * })
   * 
  **/
  updateMany<T extends SlashUpdateManyArgs>(
    args: Subset<T, SlashUpdateManyArgs>
  ): Promise<BatchPayload>
  /**
   * Create or update one Slash.
   * @param {SlashUpsertArgs} args - Arguments to update or create a Slash.
   * @example
   * // Update or create a Slash
   * const slash = await prisma.slash.upsert({
   *   create: {
   *     // ... data to create a Slash
   *   },
   *   update: {
   *     // ... in case it already exists, update
   *   },
   *   where: {
   *     // ... the filter for the Slash we want to update
   *   }
   * })
  **/
  upsert<T extends SlashUpsertArgs>(
    args: Subset<T, SlashUpsertArgs>
  ): CheckSelect<T, Prisma__SlashClient<Slash>, Prisma__SlashClient<SlashGetPayload<T>>>
  /**
   * Count
   */
  count(args?: Omit<FindManySlashArgs, 'select' | 'include'>): Promise<number>

  /**
   * Aggregate
   */
  aggregate<T extends AggregateSlashArgs>(args: Subset<T, AggregateSlashArgs>): Promise<GetSlashAggregateType<T>>
}

/**
 * The delegate class that acts as a "Promise-like" for Slash.
 * Why is this prefixed with `Prisma__`?
 * Because we want to prevent naming conflicts as mentioned in 
 * https://github.com/prisma/prisma-client-js/issues/707
 */
export declare class Prisma__SlashClient<T> implements Promise<T> {
  private readonly _dmmf;
  private readonly _fetcher;
  private readonly _queryType;
  private readonly _rootField;
  private readonly _clientMethod;
  private readonly _args;
  private readonly _dataPath;
  private readonly _errorFormat;
  private readonly _measurePerformance?;
  private _isList;
  private _callsite;
  private _requestPromise?;
  constructor(_dmmf: DMMFClass, _fetcher: PrismaClientFetcher, _queryType: 'query' | 'mutation', _rootField: string, _clientMethod: string, _args: any, _dataPath: string[], _errorFormat: ErrorFormat, _measurePerformance?: boolean | undefined, _isList?: boolean);
  readonly [Symbol.toStringTag]: 'PrismaClientPromise';

  block<T extends BlockArgs = {}>(args?: Subset<T, BlockArgs>): CheckSelect<T, Prisma__BlockClient<Block | null>, Prisma__BlockClient<BlockGetPayload<T> | null>>;

  private get _document();
  /**
   * Attaches callbacks for the resolution and/or rejection of the Promise.
   * @param onfulfilled The callback to execute when the Promise is resolved.
   * @param onrejected The callback to execute when the Promise is rejected.
   * @returns A Promise for the completion of which ever callback is executed.
   */
  then<TResult1 = T, TResult2 = never>(onfulfilled?: ((value: T) => TResult1 | Promise<TResult1>) | undefined | null, onrejected?: ((reason: any) => TResult2 | Promise<TResult2>) | undefined | null): Promise<TResult1 | TResult2>;
  /**
   * Attaches a callback for only the rejection of the Promise.
   * @param onrejected The callback to execute when the Promise is rejected.
   * @returns A Promise for the completion of the callback.
   */
  catch<TResult = never>(onrejected?: ((reason: any) => TResult | Promise<TResult>) | undefined | null): Promise<T | TResult>;
  /**
   * Attaches a callback that is invoked when the Promise is settled (fulfilled or rejected). The
   * resolved value cannot be modified from the callback.
   * @param onfinally The callback to execute when the Promise is settled (fulfilled or rejected).
   * @returns A Promise for the completion of the callback.
   */
  finally(onfinally?: (() => void) | undefined | null): Promise<T>;
}

// Custom InputTypes

/**
 * Slash findOne
 */
export type FindOneSlashArgs = {
  /**
   * Select specific fields to fetch from the Slash
  **/
  select?: SlashSelect | null
  /**
   * Choose, which related nodes to fetch as well.
  **/
  include?: SlashInclude | null
  /**
   * Filter, which Slash to fetch.
  **/
  where: SlashWhereUniqueInput
}


/**
 * Slash findMany
 */
export type FindManySlashArgs = {
  /**
   * Select specific fields to fetch from the Slash
  **/
  select?: SlashSelect | null
  /**
   * Choose, which related nodes to fetch as well.
  **/
  include?: SlashInclude | null
  /**
   * Filter, which Slashes to fetch.
  **/
  where?: SlashWhereInput
  /**
   * Determine the order of the Slashes to fetch.
  **/
  orderBy?: Enumerable<SlashOrderByInput>
  /**
   * Sets the position for listing Slashes.
  **/
  cursor?: SlashWhereUniqueInput
  /**
   * The number of Slashes to fetch. If negative number, it will take Slashes before the `cursor`.
  **/
  take?: number
  /**
   * Skip the first `n` Slashes.
  **/
  skip?: number
  distinct?: Enumerable<SlashDistinctFieldEnum>
}


/**
 * Slash create
 */
export type SlashCreateArgs = {
  /**
   * Select specific fields to fetch from the Slash
  **/
  select?: SlashSelect | null
  /**
   * Choose, which related nodes to fetch as well.
  **/
  include?: SlashInclude | null
  /**
   * The data needed to create a Slash.
  **/
  data: SlashCreateInput
}


/**
 * Slash update
 */
export type SlashUpdateArgs = {
  /**
   * Select specific fields to fetch from the Slash
  **/
  select?: SlashSelect | null
  /**
   * Choose, which related nodes to fetch as well.
  **/
  include?: SlashInclude | null
  /**
   * The data needed to update a Slash.
  **/
  data: SlashUpdateInput
  /**
   * Choose, which Slash to update.
  **/
  where: SlashWhereUniqueInput
}


/**
 * Slash updateMany
 */
export type SlashUpdateManyArgs = {
  data: SlashUpdateManyMutationInput
  where?: SlashWhereInput
}


/**
 * Slash upsert
 */
export type SlashUpsertArgs = {
  /**
   * Select specific fields to fetch from the Slash
  **/
  select?: SlashSelect | null
  /**
   * Choose, which related nodes to fetch as well.
  **/
  include?: SlashInclude | null
  /**
   * The filter to search for the Slash to update in case it exists.
  **/
  where: SlashWhereUniqueInput
  /**
   * In case the Slash found by the `where` argument doesn't exist, create a new Slash with this data.
  **/
  create: SlashCreateInput
  /**
   * In case the Slash was found with the provided `where` argument, update it with this data.
  **/
  update: SlashUpdateInput
}


/**
 * Slash delete
 */
export type SlashDeleteArgs = {
  /**
   * Select specific fields to fetch from the Slash
  **/
  select?: SlashSelect | null
  /**
   * Choose, which related nodes to fetch as well.
  **/
  include?: SlashInclude | null
  /**
   * Filter which Slash to delete.
  **/
  where: SlashWhereUniqueInput
}


/**
 * Slash deleteMany
 */
export type SlashDeleteManyArgs = {
  where?: SlashWhereInput
}


/**
 * Slash without action
 */
export type SlashArgs = {
  /**
   * Select specific fields to fetch from the Slash
  **/
  select?: SlashSelect | null
  /**
   * Choose, which related nodes to fetch as well.
  **/
  include?: SlashInclude | null
}



/**
 * Model Header
 */

export type Header = {
  hash: string
  proposer: string
  parentBlock: string
  fee: string
  utxoRoot: string
  utxoIndex: string
  nullifierRoot: string
  withdrawalRoot: string
  withdrawalIndex: string
  txRoot: string
  depositRoot: string
  migrationRoot: string
}


export type AggregateHeader = {
  count: number
}



export type AggregateHeaderArgs = {
  where?: HeaderWhereInput
  orderBy?: Enumerable<HeaderOrderByInput>
  cursor?: HeaderWhereUniqueInput
  take?: number
  skip?: number
  distinct?: Enumerable<HeaderDistinctFieldEnum>
  count?: true
}

export type GetHeaderAggregateType<T extends AggregateHeaderArgs> = {
  [P in keyof T]: P extends 'count' ? number : never
}


    
    

export type HeaderSelect = {
  hash?: boolean
  proposer?: boolean
  parentBlock?: boolean
  fee?: boolean
  utxoRoot?: boolean
  utxoIndex?: boolean
  nullifierRoot?: boolean
  withdrawalRoot?: boolean
  withdrawalIndex?: boolean
  txRoot?: boolean
  depositRoot?: boolean
  migrationRoot?: boolean
  Block?: boolean | FindManyBlockArgs
}

export type HeaderInclude = {
  Block?: boolean | FindManyBlockArgs
}

export type HeaderGetPayload<
  S extends boolean | null | undefined | HeaderArgs,
  U = keyof S
> = S extends true
  ? Header
  : S extends undefined
  ? never
  : S extends HeaderArgs | FindManyHeaderArgs
  ? 'include' extends U
    ? Header  & {
      [P in TrueKeys<S['include']>]:
      P extends 'Block'
      ? Array<BlockGetPayload<S['include'][P]>> : never
    }
  : 'select' extends U
    ? {
      [P in TrueKeys<S['select']>]:P extends keyof Header ? Header[P]
: 
      P extends 'Block'
      ? Array<BlockGetPayload<S['select'][P]>> : never
    }
  : Header
: Header


export interface HeaderDelegate {
  /**
   * Find zero or one Header.
   * @param {FindOneHeaderArgs} args - Arguments to find a Header
   * @example
   * // Get one Header
   * const header = await prisma.header.findOne({
   *   where: {
   *     // ... provide filter here
   *   }
   * })
  **/
  findOne<T extends FindOneHeaderArgs>(
    args: Subset<T, FindOneHeaderArgs>
  ): CheckSelect<T, Prisma__HeaderClient<Header | null>, Prisma__HeaderClient<HeaderGetPayload<T> | null>>
  /**
   * Find zero or more Headers.
   * @param {FindManyHeaderArgs=} args - Arguments to filter and select certain fields only.
   * @example
   * // Get all Headers
   * const headers = await prisma.header.findMany()
   * 
   * // Get first 10 Headers
   * const headers = await prisma.header.findMany({ take: 10 })
   * 
   * // Only select the `hash`
   * const headerWithHashOnly = await prisma.header.findMany({ select: { hash: true } })
   * 
  **/
  findMany<T extends FindManyHeaderArgs>(
    args?: Subset<T, FindManyHeaderArgs>
  ): CheckSelect<T, Promise<Array<Header>>, Promise<Array<HeaderGetPayload<T>>>>
  /**
   * Create a Header.
   * @param {HeaderCreateArgs} args - Arguments to create a Header.
   * @example
   * // Create one Header
   * const Header = await prisma.header.create({
   *   data: {
   *     // ... data to create a Header
   *   }
   * })
   * 
  **/
  create<T extends HeaderCreateArgs>(
    args: Subset<T, HeaderCreateArgs>
  ): CheckSelect<T, Prisma__HeaderClient<Header>, Prisma__HeaderClient<HeaderGetPayload<T>>>
  /**
   * Delete a Header.
   * @param {HeaderDeleteArgs} args - Arguments to delete one Header.
   * @example
   * // Delete one Header
   * const Header = await prisma.header.delete({
   *   where: {
   *     // ... filter to delete one Header
   *   }
   * })
   * 
  **/
  delete<T extends HeaderDeleteArgs>(
    args: Subset<T, HeaderDeleteArgs>
  ): CheckSelect<T, Prisma__HeaderClient<Header>, Prisma__HeaderClient<HeaderGetPayload<T>>>
  /**
   * Update one Header.
   * @param {HeaderUpdateArgs} args - Arguments to update one Header.
   * @example
   * // Update one Header
   * const header = await prisma.header.update({
   *   where: {
   *     // ... provide filter here
   *   },
   *   data: {
   *     // ... provide data here
   *   }
   * })
   * 
  **/
  update<T extends HeaderUpdateArgs>(
    args: Subset<T, HeaderUpdateArgs>
  ): CheckSelect<T, Prisma__HeaderClient<Header>, Prisma__HeaderClient<HeaderGetPayload<T>>>
  /**
   * Delete zero or more Headers.
   * @param {HeaderDeleteManyArgs} args - Arguments to filter Headers to delete.
   * @example
   * // Delete a few Headers
   * const { count } = await prisma.header.deleteMany({
   *   where: {
   *     // ... provide filter here
   *   }
   * })
   * 
  **/
  deleteMany<T extends HeaderDeleteManyArgs>(
    args: Subset<T, HeaderDeleteManyArgs>
  ): Promise<BatchPayload>
  /**
   * Update zero or more Headers.
   * @param {HeaderUpdateManyArgs} args - Arguments to update one or more rows.
   * @example
   * // Update many Headers
   * const header = await prisma.header.updateMany({
   *   where: {
   *     // ... provide filter here
   *   },
   *   data: {
   *     // ... provide data here
   *   }
   * })
   * 
  **/
  updateMany<T extends HeaderUpdateManyArgs>(
    args: Subset<T, HeaderUpdateManyArgs>
  ): Promise<BatchPayload>
  /**
   * Create or update one Header.
   * @param {HeaderUpsertArgs} args - Arguments to update or create a Header.
   * @example
   * // Update or create a Header
   * const header = await prisma.header.upsert({
   *   create: {
   *     // ... data to create a Header
   *   },
   *   update: {
   *     // ... in case it already exists, update
   *   },
   *   where: {
   *     // ... the filter for the Header we want to update
   *   }
   * })
  **/
  upsert<T extends HeaderUpsertArgs>(
    args: Subset<T, HeaderUpsertArgs>
  ): CheckSelect<T, Prisma__HeaderClient<Header>, Prisma__HeaderClient<HeaderGetPayload<T>>>
  /**
   * Count
   */
  count(args?: Omit<FindManyHeaderArgs, 'select' | 'include'>): Promise<number>

  /**
   * Aggregate
   */
  aggregate<T extends AggregateHeaderArgs>(args: Subset<T, AggregateHeaderArgs>): Promise<GetHeaderAggregateType<T>>
}

/**
 * The delegate class that acts as a "Promise-like" for Header.
 * Why is this prefixed with `Prisma__`?
 * Because we want to prevent naming conflicts as mentioned in 
 * https://github.com/prisma/prisma-client-js/issues/707
 */
export declare class Prisma__HeaderClient<T> implements Promise<T> {
  private readonly _dmmf;
  private readonly _fetcher;
  private readonly _queryType;
  private readonly _rootField;
  private readonly _clientMethod;
  private readonly _args;
  private readonly _dataPath;
  private readonly _errorFormat;
  private readonly _measurePerformance?;
  private _isList;
  private _callsite;
  private _requestPromise?;
  constructor(_dmmf: DMMFClass, _fetcher: PrismaClientFetcher, _queryType: 'query' | 'mutation', _rootField: string, _clientMethod: string, _args: any, _dataPath: string[], _errorFormat: ErrorFormat, _measurePerformance?: boolean | undefined, _isList?: boolean);
  readonly [Symbol.toStringTag]: 'PrismaClientPromise';

  Block<T extends FindManyBlockArgs = {}>(args?: Subset<T, FindManyBlockArgs>): CheckSelect<T, Promise<Array<Block>>, Promise<Array<BlockGetPayload<T>>>>;

  private get _document();
  /**
   * Attaches callbacks for the resolution and/or rejection of the Promise.
   * @param onfulfilled The callback to execute when the Promise is resolved.
   * @param onrejected The callback to execute when the Promise is rejected.
   * @returns A Promise for the completion of which ever callback is executed.
   */
  then<TResult1 = T, TResult2 = never>(onfulfilled?: ((value: T) => TResult1 | Promise<TResult1>) | undefined | null, onrejected?: ((reason: any) => TResult2 | Promise<TResult2>) | undefined | null): Promise<TResult1 | TResult2>;
  /**
   * Attaches a callback for only the rejection of the Promise.
   * @param onrejected The callback to execute when the Promise is rejected.
   * @returns A Promise for the completion of the callback.
   */
  catch<TResult = never>(onrejected?: ((reason: any) => TResult | Promise<TResult>) | undefined | null): Promise<T | TResult>;
  /**
   * Attaches a callback that is invoked when the Promise is settled (fulfilled or rejected). The
   * resolved value cannot be modified from the callback.
   * @param onfinally The callback to execute when the Promise is settled (fulfilled or rejected).
   * @returns A Promise for the completion of the callback.
   */
  finally(onfinally?: (() => void) | undefined | null): Promise<T>;
}

// Custom InputTypes

/**
 * Header findOne
 */
export type FindOneHeaderArgs = {
  /**
   * Select specific fields to fetch from the Header
  **/
  select?: HeaderSelect | null
  /**
   * Choose, which related nodes to fetch as well.
  **/
  include?: HeaderInclude | null
  /**
   * Filter, which Header to fetch.
  **/
  where: HeaderWhereUniqueInput
}


/**
 * Header findMany
 */
export type FindManyHeaderArgs = {
  /**
   * Select specific fields to fetch from the Header
  **/
  select?: HeaderSelect | null
  /**
   * Choose, which related nodes to fetch as well.
  **/
  include?: HeaderInclude | null
  /**
   * Filter, which Headers to fetch.
  **/
  where?: HeaderWhereInput
  /**
   * Determine the order of the Headers to fetch.
  **/
  orderBy?: Enumerable<HeaderOrderByInput>
  /**
   * Sets the position for listing Headers.
  **/
  cursor?: HeaderWhereUniqueInput
  /**
   * The number of Headers to fetch. If negative number, it will take Headers before the `cursor`.
  **/
  take?: number
  /**
   * Skip the first `n` Headers.
  **/
  skip?: number
  distinct?: Enumerable<HeaderDistinctFieldEnum>
}


/**
 * Header create
 */
export type HeaderCreateArgs = {
  /**
   * Select specific fields to fetch from the Header
  **/
  select?: HeaderSelect | null
  /**
   * Choose, which related nodes to fetch as well.
  **/
  include?: HeaderInclude | null
  /**
   * The data needed to create a Header.
  **/
  data: HeaderCreateInput
}


/**
 * Header update
 */
export type HeaderUpdateArgs = {
  /**
   * Select specific fields to fetch from the Header
  **/
  select?: HeaderSelect | null
  /**
   * Choose, which related nodes to fetch as well.
  **/
  include?: HeaderInclude | null
  /**
   * The data needed to update a Header.
  **/
  data: HeaderUpdateInput
  /**
   * Choose, which Header to update.
  **/
  where: HeaderWhereUniqueInput
}


/**
 * Header updateMany
 */
export type HeaderUpdateManyArgs = {
  data: HeaderUpdateManyMutationInput
  where?: HeaderWhereInput
}


/**
 * Header upsert
 */
export type HeaderUpsertArgs = {
  /**
   * Select specific fields to fetch from the Header
  **/
  select?: HeaderSelect | null
  /**
   * Choose, which related nodes to fetch as well.
  **/
  include?: HeaderInclude | null
  /**
   * The filter to search for the Header to update in case it exists.
  **/
  where: HeaderWhereUniqueInput
  /**
   * In case the Header found by the `where` argument doesn't exist, create a new Header with this data.
  **/
  create: HeaderCreateInput
  /**
   * In case the Header was found with the provided `where` argument, update it with this data.
  **/
  update: HeaderUpdateInput
}


/**
 * Header delete
 */
export type HeaderDeleteArgs = {
  /**
   * Select specific fields to fetch from the Header
  **/
  select?: HeaderSelect | null
  /**
   * Choose, which related nodes to fetch as well.
  **/
  include?: HeaderInclude | null
  /**
   * Filter which Header to delete.
  **/
  where: HeaderWhereUniqueInput
}


/**
 * Header deleteMany
 */
export type HeaderDeleteManyArgs = {
  where?: HeaderWhereInput
}


/**
 * Header without action
 */
export type HeaderArgs = {
  /**
   * Select specific fields to fetch from the Header
  **/
  select?: HeaderSelect | null
  /**
   * Choose, which related nodes to fetch as well.
  **/
  include?: HeaderInclude | null
}



/**
 * Model Bootstrap
 */

export type Bootstrap = {
  id: string
  blockHash: string | null
  utxoBootstrap: string
  withdrawalBootstrap: string
}


export type AggregateBootstrap = {
  count: number
}



export type AggregateBootstrapArgs = {
  where?: BootstrapWhereInput
  orderBy?: Enumerable<BootstrapOrderByInput>
  cursor?: BootstrapWhereUniqueInput
  take?: number
  skip?: number
  distinct?: Enumerable<BootstrapDistinctFieldEnum>
  count?: true
}

export type GetBootstrapAggregateType<T extends AggregateBootstrapArgs> = {
  [P in keyof T]: P extends 'count' ? number : never
}


    
    

export type BootstrapSelect = {
  id?: boolean
  blockHash?: boolean
  utxoBootstrap?: boolean
  withdrawalBootstrap?: boolean
  block?: boolean | BlockArgs
}

export type BootstrapInclude = {
  block?: boolean | BlockArgs
}

export type BootstrapGetPayload<
  S extends boolean | null | undefined | BootstrapArgs,
  U = keyof S
> = S extends true
  ? Bootstrap
  : S extends undefined
  ? never
  : S extends BootstrapArgs | FindManyBootstrapArgs
  ? 'include' extends U
    ? Bootstrap  & {
      [P in TrueKeys<S['include']>]:
      P extends 'block'
      ? BlockGetPayload<S['include'][P]> | null : never
    }
  : 'select' extends U
    ? {
      [P in TrueKeys<S['select']>]:P extends keyof Bootstrap ? Bootstrap[P]
: 
      P extends 'block'
      ? BlockGetPayload<S['select'][P]> | null : never
    }
  : Bootstrap
: Bootstrap


export interface BootstrapDelegate {
  /**
   * Find zero or one Bootstrap.
   * @param {FindOneBootstrapArgs} args - Arguments to find a Bootstrap
   * @example
   * // Get one Bootstrap
   * const bootstrap = await prisma.bootstrap.findOne({
   *   where: {
   *     // ... provide filter here
   *   }
   * })
  **/
  findOne<T extends FindOneBootstrapArgs>(
    args: Subset<T, FindOneBootstrapArgs>
  ): CheckSelect<T, Prisma__BootstrapClient<Bootstrap | null>, Prisma__BootstrapClient<BootstrapGetPayload<T> | null>>
  /**
   * Find zero or more Bootstraps.
   * @param {FindManyBootstrapArgs=} args - Arguments to filter and select certain fields only.
   * @example
   * // Get all Bootstraps
   * const bootstraps = await prisma.bootstrap.findMany()
   * 
   * // Get first 10 Bootstraps
   * const bootstraps = await prisma.bootstrap.findMany({ take: 10 })
   * 
   * // Only select the `id`
   * const bootstrapWithIdOnly = await prisma.bootstrap.findMany({ select: { id: true } })
   * 
  **/
  findMany<T extends FindManyBootstrapArgs>(
    args?: Subset<T, FindManyBootstrapArgs>
  ): CheckSelect<T, Promise<Array<Bootstrap>>, Promise<Array<BootstrapGetPayload<T>>>>
  /**
   * Create a Bootstrap.
   * @param {BootstrapCreateArgs} args - Arguments to create a Bootstrap.
   * @example
   * // Create one Bootstrap
   * const Bootstrap = await prisma.bootstrap.create({
   *   data: {
   *     // ... data to create a Bootstrap
   *   }
   * })
   * 
  **/
  create<T extends BootstrapCreateArgs>(
    args: Subset<T, BootstrapCreateArgs>
  ): CheckSelect<T, Prisma__BootstrapClient<Bootstrap>, Prisma__BootstrapClient<BootstrapGetPayload<T>>>
  /**
   * Delete a Bootstrap.
   * @param {BootstrapDeleteArgs} args - Arguments to delete one Bootstrap.
   * @example
   * // Delete one Bootstrap
   * const Bootstrap = await prisma.bootstrap.delete({
   *   where: {
   *     // ... filter to delete one Bootstrap
   *   }
   * })
   * 
  **/
  delete<T extends BootstrapDeleteArgs>(
    args: Subset<T, BootstrapDeleteArgs>
  ): CheckSelect<T, Prisma__BootstrapClient<Bootstrap>, Prisma__BootstrapClient<BootstrapGetPayload<T>>>
  /**
   * Update one Bootstrap.
   * @param {BootstrapUpdateArgs} args - Arguments to update one Bootstrap.
   * @example
   * // Update one Bootstrap
   * const bootstrap = await prisma.bootstrap.update({
   *   where: {
   *     // ... provide filter here
   *   },
   *   data: {
   *     // ... provide data here
   *   }
   * })
   * 
  **/
  update<T extends BootstrapUpdateArgs>(
    args: Subset<T, BootstrapUpdateArgs>
  ): CheckSelect<T, Prisma__BootstrapClient<Bootstrap>, Prisma__BootstrapClient<BootstrapGetPayload<T>>>
  /**
   * Delete zero or more Bootstraps.
   * @param {BootstrapDeleteManyArgs} args - Arguments to filter Bootstraps to delete.
   * @example
   * // Delete a few Bootstraps
   * const { count } = await prisma.bootstrap.deleteMany({
   *   where: {
   *     // ... provide filter here
   *   }
   * })
   * 
  **/
  deleteMany<T extends BootstrapDeleteManyArgs>(
    args: Subset<T, BootstrapDeleteManyArgs>
  ): Promise<BatchPayload>
  /**
   * Update zero or more Bootstraps.
   * @param {BootstrapUpdateManyArgs} args - Arguments to update one or more rows.
   * @example
   * // Update many Bootstraps
   * const bootstrap = await prisma.bootstrap.updateMany({
   *   where: {
   *     // ... provide filter here
   *   },
   *   data: {
   *     // ... provide data here
   *   }
   * })
   * 
  **/
  updateMany<T extends BootstrapUpdateManyArgs>(
    args: Subset<T, BootstrapUpdateManyArgs>
  ): Promise<BatchPayload>
  /**
   * Create or update one Bootstrap.
   * @param {BootstrapUpsertArgs} args - Arguments to update or create a Bootstrap.
   * @example
   * // Update or create a Bootstrap
   * const bootstrap = await prisma.bootstrap.upsert({
   *   create: {
   *     // ... data to create a Bootstrap
   *   },
   *   update: {
   *     // ... in case it already exists, update
   *   },
   *   where: {
   *     // ... the filter for the Bootstrap we want to update
   *   }
   * })
  **/
  upsert<T extends BootstrapUpsertArgs>(
    args: Subset<T, BootstrapUpsertArgs>
  ): CheckSelect<T, Prisma__BootstrapClient<Bootstrap>, Prisma__BootstrapClient<BootstrapGetPayload<T>>>
  /**
   * Count
   */
  count(args?: Omit<FindManyBootstrapArgs, 'select' | 'include'>): Promise<number>

  /**
   * Aggregate
   */
  aggregate<T extends AggregateBootstrapArgs>(args: Subset<T, AggregateBootstrapArgs>): Promise<GetBootstrapAggregateType<T>>
}

/**
 * The delegate class that acts as a "Promise-like" for Bootstrap.
 * Why is this prefixed with `Prisma__`?
 * Because we want to prevent naming conflicts as mentioned in 
 * https://github.com/prisma/prisma-client-js/issues/707
 */
export declare class Prisma__BootstrapClient<T> implements Promise<T> {
  private readonly _dmmf;
  private readonly _fetcher;
  private readonly _queryType;
  private readonly _rootField;
  private readonly _clientMethod;
  private readonly _args;
  private readonly _dataPath;
  private readonly _errorFormat;
  private readonly _measurePerformance?;
  private _isList;
  private _callsite;
  private _requestPromise?;
  constructor(_dmmf: DMMFClass, _fetcher: PrismaClientFetcher, _queryType: 'query' | 'mutation', _rootField: string, _clientMethod: string, _args: any, _dataPath: string[], _errorFormat: ErrorFormat, _measurePerformance?: boolean | undefined, _isList?: boolean);
  readonly [Symbol.toStringTag]: 'PrismaClientPromise';

  block<T extends BlockArgs = {}>(args?: Subset<T, BlockArgs>): CheckSelect<T, Prisma__BlockClient<Block | null>, Prisma__BlockClient<BlockGetPayload<T> | null>>;

  private get _document();
  /**
   * Attaches callbacks for the resolution and/or rejection of the Promise.
   * @param onfulfilled The callback to execute when the Promise is resolved.
   * @param onrejected The callback to execute when the Promise is rejected.
   * @returns A Promise for the completion of which ever callback is executed.
   */
  then<TResult1 = T, TResult2 = never>(onfulfilled?: ((value: T) => TResult1 | Promise<TResult1>) | undefined | null, onrejected?: ((reason: any) => TResult2 | Promise<TResult2>) | undefined | null): Promise<TResult1 | TResult2>;
  /**
   * Attaches a callback for only the rejection of the Promise.
   * @param onrejected The callback to execute when the Promise is rejected.
   * @returns A Promise for the completion of the callback.
   */
  catch<TResult = never>(onrejected?: ((reason: any) => TResult | Promise<TResult>) | undefined | null): Promise<T | TResult>;
  /**
   * Attaches a callback that is invoked when the Promise is settled (fulfilled or rejected). The
   * resolved value cannot be modified from the callback.
   * @param onfinally The callback to execute when the Promise is settled (fulfilled or rejected).
   * @returns A Promise for the completion of the callback.
   */
  finally(onfinally?: (() => void) | undefined | null): Promise<T>;
}

// Custom InputTypes

/**
 * Bootstrap findOne
 */
export type FindOneBootstrapArgs = {
  /**
   * Select specific fields to fetch from the Bootstrap
  **/
  select?: BootstrapSelect | null
  /**
   * Choose, which related nodes to fetch as well.
  **/
  include?: BootstrapInclude | null
  /**
   * Filter, which Bootstrap to fetch.
  **/
  where: BootstrapWhereUniqueInput
}


/**
 * Bootstrap findMany
 */
export type FindManyBootstrapArgs = {
  /**
   * Select specific fields to fetch from the Bootstrap
  **/
  select?: BootstrapSelect | null
  /**
   * Choose, which related nodes to fetch as well.
  **/
  include?: BootstrapInclude | null
  /**
   * Filter, which Bootstraps to fetch.
  **/
  where?: BootstrapWhereInput
  /**
   * Determine the order of the Bootstraps to fetch.
  **/
  orderBy?: Enumerable<BootstrapOrderByInput>
  /**
   * Sets the position for listing Bootstraps.
  **/
  cursor?: BootstrapWhereUniqueInput
  /**
   * The number of Bootstraps to fetch. If negative number, it will take Bootstraps before the `cursor`.
  **/
  take?: number
  /**
   * Skip the first `n` Bootstraps.
  **/
  skip?: number
  distinct?: Enumerable<BootstrapDistinctFieldEnum>
}


/**
 * Bootstrap create
 */
export type BootstrapCreateArgs = {
  /**
   * Select specific fields to fetch from the Bootstrap
  **/
  select?: BootstrapSelect | null
  /**
   * Choose, which related nodes to fetch as well.
  **/
  include?: BootstrapInclude | null
  /**
   * The data needed to create a Bootstrap.
  **/
  data: BootstrapCreateInput
}


/**
 * Bootstrap update
 */
export type BootstrapUpdateArgs = {
  /**
   * Select specific fields to fetch from the Bootstrap
  **/
  select?: BootstrapSelect | null
  /**
   * Choose, which related nodes to fetch as well.
  **/
  include?: BootstrapInclude | null
  /**
   * The data needed to update a Bootstrap.
  **/
  data: BootstrapUpdateInput
  /**
   * Choose, which Bootstrap to update.
  **/
  where: BootstrapWhereUniqueInput
}


/**
 * Bootstrap updateMany
 */
export type BootstrapUpdateManyArgs = {
  data: BootstrapUpdateManyMutationInput
  where?: BootstrapWhereInput
}


/**
 * Bootstrap upsert
 */
export type BootstrapUpsertArgs = {
  /**
   * Select specific fields to fetch from the Bootstrap
  **/
  select?: BootstrapSelect | null
  /**
   * Choose, which related nodes to fetch as well.
  **/
  include?: BootstrapInclude | null
  /**
   * The filter to search for the Bootstrap to update in case it exists.
  **/
  where: BootstrapWhereUniqueInput
  /**
   * In case the Bootstrap found by the `where` argument doesn't exist, create a new Bootstrap with this data.
  **/
  create: BootstrapCreateInput
  /**
   * In case the Bootstrap was found with the provided `where` argument, update it with this data.
  **/
  update: BootstrapUpdateInput
}


/**
 * Bootstrap delete
 */
export type BootstrapDeleteArgs = {
  /**
   * Select specific fields to fetch from the Bootstrap
  **/
  select?: BootstrapSelect | null
  /**
   * Choose, which related nodes to fetch as well.
  **/
  include?: BootstrapInclude | null
  /**
   * Filter which Bootstrap to delete.
  **/
  where: BootstrapWhereUniqueInput
}


/**
 * Bootstrap deleteMany
 */
export type BootstrapDeleteManyArgs = {
  where?: BootstrapWhereInput
}


/**
 * Bootstrap without action
 */
export type BootstrapArgs = {
  /**
   * Select specific fields to fetch from the Bootstrap
  **/
  select?: BootstrapSelect | null
  /**
   * Choose, which related nodes to fetch as well.
  **/
  include?: BootstrapInclude | null
}



/**
 * Model MassDeposit
 */

export type MassDeposit = {
  index: string
  merged: string
  fee: string
  blockNumber: number
  includedIn: string | null
}


export type AggregateMassDeposit = {
  count: number
  avg: MassDepositAvgAggregateOutputType | null
  sum: MassDepositSumAggregateOutputType | null
  min: MassDepositMinAggregateOutputType | null
  max: MassDepositMaxAggregateOutputType | null
}

export type MassDepositAvgAggregateOutputType = {
  blockNumber: number
}

export type MassDepositSumAggregateOutputType = {
  blockNumber: number
}

export type MassDepositMinAggregateOutputType = {
  blockNumber: number
}

export type MassDepositMaxAggregateOutputType = {
  blockNumber: number
}


export type MassDepositAvgAggregateInputType = {
  blockNumber?: true
}

export type MassDepositSumAggregateInputType = {
  blockNumber?: true
}

export type MassDepositMinAggregateInputType = {
  blockNumber?: true
}

export type MassDepositMaxAggregateInputType = {
  blockNumber?: true
}

export type AggregateMassDepositArgs = {
  where?: MassDepositWhereInput
  orderBy?: Enumerable<MassDepositOrderByInput>
  cursor?: MassDepositWhereUniqueInput
  take?: number
  skip?: number
  distinct?: Enumerable<MassDepositDistinctFieldEnum>
  count?: true
  avg?: MassDepositAvgAggregateInputType
  sum?: MassDepositSumAggregateInputType
  min?: MassDepositMinAggregateInputType
  max?: MassDepositMaxAggregateInputType
}

export type GetMassDepositAggregateType<T extends AggregateMassDepositArgs> = {
  [P in keyof T]: P extends 'count' ? number : GetMassDepositAggregateScalarType<T[P]>
}

export type GetMassDepositAggregateScalarType<T extends any> = {
  [P in keyof T]: P extends keyof MassDepositAvgAggregateOutputType ? MassDepositAvgAggregateOutputType[P] : never
}
    
    

export type MassDepositSelect = {
  index?: boolean
  merged?: boolean
  fee?: boolean
  blockNumber?: boolean
  includedIn?: boolean
}

export type MassDepositGetPayload<
  S extends boolean | null | undefined | MassDepositArgs,
  U = keyof S
> = S extends true
  ? MassDeposit
  : S extends undefined
  ? never
  : S extends MassDepositArgs | FindManyMassDepositArgs
  ? 'include' extends U
    ? MassDeposit 
  : 'select' extends U
    ? {
      [P in TrueKeys<S['select']>]:P extends keyof MassDeposit ? MassDeposit[P]
: 
 never
    }
  : MassDeposit
: MassDeposit


export interface MassDepositDelegate {
  /**
   * Find zero or one MassDeposit.
   * @param {FindOneMassDepositArgs} args - Arguments to find a MassDeposit
   * @example
   * // Get one MassDeposit
   * const massDeposit = await prisma.massDeposit.findOne({
   *   where: {
   *     // ... provide filter here
   *   }
   * })
  **/
  findOne<T extends FindOneMassDepositArgs>(
    args: Subset<T, FindOneMassDepositArgs>
  ): CheckSelect<T, Prisma__MassDepositClient<MassDeposit | null>, Prisma__MassDepositClient<MassDepositGetPayload<T> | null>>
  /**
   * Find zero or more MassDeposits.
   * @param {FindManyMassDepositArgs=} args - Arguments to filter and select certain fields only.
   * @example
   * // Get all MassDeposits
   * const massDeposits = await prisma.massDeposit.findMany()
   * 
   * // Get first 10 MassDeposits
   * const massDeposits = await prisma.massDeposit.findMany({ take: 10 })
   * 
   * // Only select the `index`
   * const massDepositWithIndexOnly = await prisma.massDeposit.findMany({ select: { index: true } })
   * 
  **/
  findMany<T extends FindManyMassDepositArgs>(
    args?: Subset<T, FindManyMassDepositArgs>
  ): CheckSelect<T, Promise<Array<MassDeposit>>, Promise<Array<MassDepositGetPayload<T>>>>
  /**
   * Create a MassDeposit.
   * @param {MassDepositCreateArgs} args - Arguments to create a MassDeposit.
   * @example
   * // Create one MassDeposit
   * const MassDeposit = await prisma.massDeposit.create({
   *   data: {
   *     // ... data to create a MassDeposit
   *   }
   * })
   * 
  **/
  create<T extends MassDepositCreateArgs>(
    args: Subset<T, MassDepositCreateArgs>
  ): CheckSelect<T, Prisma__MassDepositClient<MassDeposit>, Prisma__MassDepositClient<MassDepositGetPayload<T>>>
  /**
   * Delete a MassDeposit.
   * @param {MassDepositDeleteArgs} args - Arguments to delete one MassDeposit.
   * @example
   * // Delete one MassDeposit
   * const MassDeposit = await prisma.massDeposit.delete({
   *   where: {
   *     // ... filter to delete one MassDeposit
   *   }
   * })
   * 
  **/
  delete<T extends MassDepositDeleteArgs>(
    args: Subset<T, MassDepositDeleteArgs>
  ): CheckSelect<T, Prisma__MassDepositClient<MassDeposit>, Prisma__MassDepositClient<MassDepositGetPayload<T>>>
  /**
   * Update one MassDeposit.
   * @param {MassDepositUpdateArgs} args - Arguments to update one MassDeposit.
   * @example
   * // Update one MassDeposit
   * const massDeposit = await prisma.massDeposit.update({
   *   where: {
   *     // ... provide filter here
   *   },
   *   data: {
   *     // ... provide data here
   *   }
   * })
   * 
  **/
  update<T extends MassDepositUpdateArgs>(
    args: Subset<T, MassDepositUpdateArgs>
  ): CheckSelect<T, Prisma__MassDepositClient<MassDeposit>, Prisma__MassDepositClient<MassDepositGetPayload<T>>>
  /**
   * Delete zero or more MassDeposits.
   * @param {MassDepositDeleteManyArgs} args - Arguments to filter MassDeposits to delete.
   * @example
   * // Delete a few MassDeposits
   * const { count } = await prisma.massDeposit.deleteMany({
   *   where: {
   *     // ... provide filter here
   *   }
   * })
   * 
  **/
  deleteMany<T extends MassDepositDeleteManyArgs>(
    args: Subset<T, MassDepositDeleteManyArgs>
  ): Promise<BatchPayload>
  /**
   * Update zero or more MassDeposits.
   * @param {MassDepositUpdateManyArgs} args - Arguments to update one or more rows.
   * @example
   * // Update many MassDeposits
   * const massDeposit = await prisma.massDeposit.updateMany({
   *   where: {
   *     // ... provide filter here
   *   },
   *   data: {
   *     // ... provide data here
   *   }
   * })
   * 
  **/
  updateMany<T extends MassDepositUpdateManyArgs>(
    args: Subset<T, MassDepositUpdateManyArgs>
  ): Promise<BatchPayload>
  /**
   * Create or update one MassDeposit.
   * @param {MassDepositUpsertArgs} args - Arguments to update or create a MassDeposit.
   * @example
   * // Update or create a MassDeposit
   * const massDeposit = await prisma.massDeposit.upsert({
   *   create: {
   *     // ... data to create a MassDeposit
   *   },
   *   update: {
   *     // ... in case it already exists, update
   *   },
   *   where: {
   *     // ... the filter for the MassDeposit we want to update
   *   }
   * })
  **/
  upsert<T extends MassDepositUpsertArgs>(
    args: Subset<T, MassDepositUpsertArgs>
  ): CheckSelect<T, Prisma__MassDepositClient<MassDeposit>, Prisma__MassDepositClient<MassDepositGetPayload<T>>>
  /**
   * Count
   */
  count(args?: Omit<FindManyMassDepositArgs, 'select' | 'include'>): Promise<number>

  /**
   * Aggregate
   */
  aggregate<T extends AggregateMassDepositArgs>(args: Subset<T, AggregateMassDepositArgs>): Promise<GetMassDepositAggregateType<T>>
}

/**
 * The delegate class that acts as a "Promise-like" for MassDeposit.
 * Why is this prefixed with `Prisma__`?
 * Because we want to prevent naming conflicts as mentioned in 
 * https://github.com/prisma/prisma-client-js/issues/707
 */
export declare class Prisma__MassDepositClient<T> implements Promise<T> {
  private readonly _dmmf;
  private readonly _fetcher;
  private readonly _queryType;
  private readonly _rootField;
  private readonly _clientMethod;
  private readonly _args;
  private readonly _dataPath;
  private readonly _errorFormat;
  private readonly _measurePerformance?;
  private _isList;
  private _callsite;
  private _requestPromise?;
  constructor(_dmmf: DMMFClass, _fetcher: PrismaClientFetcher, _queryType: 'query' | 'mutation', _rootField: string, _clientMethod: string, _args: any, _dataPath: string[], _errorFormat: ErrorFormat, _measurePerformance?: boolean | undefined, _isList?: boolean);
  readonly [Symbol.toStringTag]: 'PrismaClientPromise';


  private get _document();
  /**
   * Attaches callbacks for the resolution and/or rejection of the Promise.
   * @param onfulfilled The callback to execute when the Promise is resolved.
   * @param onrejected The callback to execute when the Promise is rejected.
   * @returns A Promise for the completion of which ever callback is executed.
   */
  then<TResult1 = T, TResult2 = never>(onfulfilled?: ((value: T) => TResult1 | Promise<TResult1>) | undefined | null, onrejected?: ((reason: any) => TResult2 | Promise<TResult2>) | undefined | null): Promise<TResult1 | TResult2>;
  /**
   * Attaches a callback for only the rejection of the Promise.
   * @param onrejected The callback to execute when the Promise is rejected.
   * @returns A Promise for the completion of the callback.
   */
  catch<TResult = never>(onrejected?: ((reason: any) => TResult | Promise<TResult>) | undefined | null): Promise<T | TResult>;
  /**
   * Attaches a callback that is invoked when the Promise is settled (fulfilled or rejected). The
   * resolved value cannot be modified from the callback.
   * @param onfinally The callback to execute when the Promise is settled (fulfilled or rejected).
   * @returns A Promise for the completion of the callback.
   */
  finally(onfinally?: (() => void) | undefined | null): Promise<T>;
}

// Custom InputTypes

/**
 * MassDeposit findOne
 */
export type FindOneMassDepositArgs = {
  /**
   * Select specific fields to fetch from the MassDeposit
  **/
  select?: MassDepositSelect | null
  /**
   * Filter, which MassDeposit to fetch.
  **/
  where: MassDepositWhereUniqueInput
}


/**
 * MassDeposit findMany
 */
export type FindManyMassDepositArgs = {
  /**
   * Select specific fields to fetch from the MassDeposit
  **/
  select?: MassDepositSelect | null
  /**
   * Filter, which MassDeposits to fetch.
  **/
  where?: MassDepositWhereInput
  /**
   * Determine the order of the MassDeposits to fetch.
  **/
  orderBy?: Enumerable<MassDepositOrderByInput>
  /**
   * Sets the position for listing MassDeposits.
  **/
  cursor?: MassDepositWhereUniqueInput
  /**
   * The number of MassDeposits to fetch. If negative number, it will take MassDeposits before the `cursor`.
  **/
  take?: number
  /**
   * Skip the first `n` MassDeposits.
  **/
  skip?: number
  distinct?: Enumerable<MassDepositDistinctFieldEnum>
}


/**
 * MassDeposit create
 */
export type MassDepositCreateArgs = {
  /**
   * Select specific fields to fetch from the MassDeposit
  **/
  select?: MassDepositSelect | null
  /**
   * The data needed to create a MassDeposit.
  **/
  data: MassDepositCreateInput
}


/**
 * MassDeposit update
 */
export type MassDepositUpdateArgs = {
  /**
   * Select specific fields to fetch from the MassDeposit
  **/
  select?: MassDepositSelect | null
  /**
   * The data needed to update a MassDeposit.
  **/
  data: MassDepositUpdateInput
  /**
   * Choose, which MassDeposit to update.
  **/
  where: MassDepositWhereUniqueInput
}


/**
 * MassDeposit updateMany
 */
export type MassDepositUpdateManyArgs = {
  data: MassDepositUpdateManyMutationInput
  where?: MassDepositWhereInput
}


/**
 * MassDeposit upsert
 */
export type MassDepositUpsertArgs = {
  /**
   * Select specific fields to fetch from the MassDeposit
  **/
  select?: MassDepositSelect | null
  /**
   * The filter to search for the MassDeposit to update in case it exists.
  **/
  where: MassDepositWhereUniqueInput
  /**
   * In case the MassDeposit found by the `where` argument doesn't exist, create a new MassDeposit with this data.
  **/
  create: MassDepositCreateInput
  /**
   * In case the MassDeposit was found with the provided `where` argument, update it with this data.
  **/
  update: MassDepositUpdateInput
}


/**
 * MassDeposit delete
 */
export type MassDepositDeleteArgs = {
  /**
   * Select specific fields to fetch from the MassDeposit
  **/
  select?: MassDepositSelect | null
  /**
   * Filter which MassDeposit to delete.
  **/
  where: MassDepositWhereUniqueInput
}


/**
 * MassDeposit deleteMany
 */
export type MassDepositDeleteManyArgs = {
  where?: MassDepositWhereInput
}


/**
 * MassDeposit without action
 */
export type MassDepositArgs = {
  /**
   * Select specific fields to fetch from the MassDeposit
  **/
  select?: MassDepositSelect | null
}



/**
 * Model Deposit
 */

export type Deposit = {
  note: string
  fee: string
  transactionIndex: number
  logIndex: number
  blockNumber: number
  queuedAt: string
}


export type AggregateDeposit = {
  count: number
  avg: DepositAvgAggregateOutputType | null
  sum: DepositSumAggregateOutputType | null
  min: DepositMinAggregateOutputType | null
  max: DepositMaxAggregateOutputType | null
}

export type DepositAvgAggregateOutputType = {
  transactionIndex: number
  logIndex: number
  blockNumber: number
}

export type DepositSumAggregateOutputType = {
  transactionIndex: number
  logIndex: number
  blockNumber: number
}

export type DepositMinAggregateOutputType = {
  transactionIndex: number
  logIndex: number
  blockNumber: number
}

export type DepositMaxAggregateOutputType = {
  transactionIndex: number
  logIndex: number
  blockNumber: number
}


export type DepositAvgAggregateInputType = {
  transactionIndex?: true
  logIndex?: true
  blockNumber?: true
}

export type DepositSumAggregateInputType = {
  transactionIndex?: true
  logIndex?: true
  blockNumber?: true
}

export type DepositMinAggregateInputType = {
  transactionIndex?: true
  logIndex?: true
  blockNumber?: true
}

export type DepositMaxAggregateInputType = {
  transactionIndex?: true
  logIndex?: true
  blockNumber?: true
}

export type AggregateDepositArgs = {
  where?: DepositWhereInput
  orderBy?: Enumerable<DepositOrderByInput>
  cursor?: DepositWhereUniqueInput
  take?: number
  skip?: number
  distinct?: Enumerable<DepositDistinctFieldEnum>
  count?: true
  avg?: DepositAvgAggregateInputType
  sum?: DepositSumAggregateInputType
  min?: DepositMinAggregateInputType
  max?: DepositMaxAggregateInputType
}

export type GetDepositAggregateType<T extends AggregateDepositArgs> = {
  [P in keyof T]: P extends 'count' ? number : GetDepositAggregateScalarType<T[P]>
}

export type GetDepositAggregateScalarType<T extends any> = {
  [P in keyof T]: P extends keyof DepositAvgAggregateOutputType ? DepositAvgAggregateOutputType[P] : never
}
    
    

export type DepositSelect = {
  note?: boolean
  fee?: boolean
  transactionIndex?: boolean
  logIndex?: boolean
  blockNumber?: boolean
  queuedAt?: boolean
}

export type DepositGetPayload<
  S extends boolean | null | undefined | DepositArgs,
  U = keyof S
> = S extends true
  ? Deposit
  : S extends undefined
  ? never
  : S extends DepositArgs | FindManyDepositArgs
  ? 'include' extends U
    ? Deposit 
  : 'select' extends U
    ? {
      [P in TrueKeys<S['select']>]:P extends keyof Deposit ? Deposit[P]
: 
 never
    }
  : Deposit
: Deposit


export interface DepositDelegate {
  /**
   * Find zero or one Deposit.
   * @param {FindOneDepositArgs} args - Arguments to find a Deposit
   * @example
   * // Get one Deposit
   * const deposit = await prisma.deposit.findOne({
   *   where: {
   *     // ... provide filter here
   *   }
   * })
  **/
  findOne<T extends FindOneDepositArgs>(
    args: Subset<T, FindOneDepositArgs>
  ): CheckSelect<T, Prisma__DepositClient<Deposit | null>, Prisma__DepositClient<DepositGetPayload<T> | null>>
  /**
   * Find zero or more Deposits.
   * @param {FindManyDepositArgs=} args - Arguments to filter and select certain fields only.
   * @example
   * // Get all Deposits
   * const deposits = await prisma.deposit.findMany()
   * 
   * // Get first 10 Deposits
   * const deposits = await prisma.deposit.findMany({ take: 10 })
   * 
   * // Only select the `note`
   * const depositWithNoteOnly = await prisma.deposit.findMany({ select: { note: true } })
   * 
  **/
  findMany<T extends FindManyDepositArgs>(
    args?: Subset<T, FindManyDepositArgs>
  ): CheckSelect<T, Promise<Array<Deposit>>, Promise<Array<DepositGetPayload<T>>>>
  /**
   * Create a Deposit.
   * @param {DepositCreateArgs} args - Arguments to create a Deposit.
   * @example
   * // Create one Deposit
   * const Deposit = await prisma.deposit.create({
   *   data: {
   *     // ... data to create a Deposit
   *   }
   * })
   * 
  **/
  create<T extends DepositCreateArgs>(
    args: Subset<T, DepositCreateArgs>
  ): CheckSelect<T, Prisma__DepositClient<Deposit>, Prisma__DepositClient<DepositGetPayload<T>>>
  /**
   * Delete a Deposit.
   * @param {DepositDeleteArgs} args - Arguments to delete one Deposit.
   * @example
   * // Delete one Deposit
   * const Deposit = await prisma.deposit.delete({
   *   where: {
   *     // ... filter to delete one Deposit
   *   }
   * })
   * 
  **/
  delete<T extends DepositDeleteArgs>(
    args: Subset<T, DepositDeleteArgs>
  ): CheckSelect<T, Prisma__DepositClient<Deposit>, Prisma__DepositClient<DepositGetPayload<T>>>
  /**
   * Update one Deposit.
   * @param {DepositUpdateArgs} args - Arguments to update one Deposit.
   * @example
   * // Update one Deposit
   * const deposit = await prisma.deposit.update({
   *   where: {
   *     // ... provide filter here
   *   },
   *   data: {
   *     // ... provide data here
   *   }
   * })
   * 
  **/
  update<T extends DepositUpdateArgs>(
    args: Subset<T, DepositUpdateArgs>
  ): CheckSelect<T, Prisma__DepositClient<Deposit>, Prisma__DepositClient<DepositGetPayload<T>>>
  /**
   * Delete zero or more Deposits.
   * @param {DepositDeleteManyArgs} args - Arguments to filter Deposits to delete.
   * @example
   * // Delete a few Deposits
   * const { count } = await prisma.deposit.deleteMany({
   *   where: {
   *     // ... provide filter here
   *   }
   * })
   * 
  **/
  deleteMany<T extends DepositDeleteManyArgs>(
    args: Subset<T, DepositDeleteManyArgs>
  ): Promise<BatchPayload>
  /**
   * Update zero or more Deposits.
   * @param {DepositUpdateManyArgs} args - Arguments to update one or more rows.
   * @example
   * // Update many Deposits
   * const deposit = await prisma.deposit.updateMany({
   *   where: {
   *     // ... provide filter here
   *   },
   *   data: {
   *     // ... provide data here
   *   }
   * })
   * 
  **/
  updateMany<T extends DepositUpdateManyArgs>(
    args: Subset<T, DepositUpdateManyArgs>
  ): Promise<BatchPayload>
  /**
   * Create or update one Deposit.
   * @param {DepositUpsertArgs} args - Arguments to update or create a Deposit.
   * @example
   * // Update or create a Deposit
   * const deposit = await prisma.deposit.upsert({
   *   create: {
   *     // ... data to create a Deposit
   *   },
   *   update: {
   *     // ... in case it already exists, update
   *   },
   *   where: {
   *     // ... the filter for the Deposit we want to update
   *   }
   * })
  **/
  upsert<T extends DepositUpsertArgs>(
    args: Subset<T, DepositUpsertArgs>
  ): CheckSelect<T, Prisma__DepositClient<Deposit>, Prisma__DepositClient<DepositGetPayload<T>>>
  /**
   * Count
   */
  count(args?: Omit<FindManyDepositArgs, 'select' | 'include'>): Promise<number>

  /**
   * Aggregate
   */
  aggregate<T extends AggregateDepositArgs>(args: Subset<T, AggregateDepositArgs>): Promise<GetDepositAggregateType<T>>
}

/**
 * The delegate class that acts as a "Promise-like" for Deposit.
 * Why is this prefixed with `Prisma__`?
 * Because we want to prevent naming conflicts as mentioned in 
 * https://github.com/prisma/prisma-client-js/issues/707
 */
export declare class Prisma__DepositClient<T> implements Promise<T> {
  private readonly _dmmf;
  private readonly _fetcher;
  private readonly _queryType;
  private readonly _rootField;
  private readonly _clientMethod;
  private readonly _args;
  private readonly _dataPath;
  private readonly _errorFormat;
  private readonly _measurePerformance?;
  private _isList;
  private _callsite;
  private _requestPromise?;
  constructor(_dmmf: DMMFClass, _fetcher: PrismaClientFetcher, _queryType: 'query' | 'mutation', _rootField: string, _clientMethod: string, _args: any, _dataPath: string[], _errorFormat: ErrorFormat, _measurePerformance?: boolean | undefined, _isList?: boolean);
  readonly [Symbol.toStringTag]: 'PrismaClientPromise';


  private get _document();
  /**
   * Attaches callbacks for the resolution and/or rejection of the Promise.
   * @param onfulfilled The callback to execute when the Promise is resolved.
   * @param onrejected The callback to execute when the Promise is rejected.
   * @returns A Promise for the completion of which ever callback is executed.
   */
  then<TResult1 = T, TResult2 = never>(onfulfilled?: ((value: T) => TResult1 | Promise<TResult1>) | undefined | null, onrejected?: ((reason: any) => TResult2 | Promise<TResult2>) | undefined | null): Promise<TResult1 | TResult2>;
  /**
   * Attaches a callback for only the rejection of the Promise.
   * @param onrejected The callback to execute when the Promise is rejected.
   * @returns A Promise for the completion of the callback.
   */
  catch<TResult = never>(onrejected?: ((reason: any) => TResult | Promise<TResult>) | undefined | null): Promise<T | TResult>;
  /**
   * Attaches a callback that is invoked when the Promise is settled (fulfilled or rejected). The
   * resolved value cannot be modified from the callback.
   * @param onfinally The callback to execute when the Promise is settled (fulfilled or rejected).
   * @returns A Promise for the completion of the callback.
   */
  finally(onfinally?: (() => void) | undefined | null): Promise<T>;
}

// Custom InputTypes

/**
 * Deposit findOne
 */
export type FindOneDepositArgs = {
  /**
   * Select specific fields to fetch from the Deposit
  **/
  select?: DepositSelect | null
  /**
   * Filter, which Deposit to fetch.
  **/
  where: DepositWhereUniqueInput
}


/**
 * Deposit findMany
 */
export type FindManyDepositArgs = {
  /**
   * Select specific fields to fetch from the Deposit
  **/
  select?: DepositSelect | null
  /**
   * Filter, which Deposits to fetch.
  **/
  where?: DepositWhereInput
  /**
   * Determine the order of the Deposits to fetch.
  **/
  orderBy?: Enumerable<DepositOrderByInput>
  /**
   * Sets the position for listing Deposits.
  **/
  cursor?: DepositWhereUniqueInput
  /**
   * The number of Deposits to fetch. If negative number, it will take Deposits before the `cursor`.
  **/
  take?: number
  /**
   * Skip the first `n` Deposits.
  **/
  skip?: number
  distinct?: Enumerable<DepositDistinctFieldEnum>
}


/**
 * Deposit create
 */
export type DepositCreateArgs = {
  /**
   * Select specific fields to fetch from the Deposit
  **/
  select?: DepositSelect | null
  /**
   * The data needed to create a Deposit.
  **/
  data: DepositCreateInput
}


/**
 * Deposit update
 */
export type DepositUpdateArgs = {
  /**
   * Select specific fields to fetch from the Deposit
  **/
  select?: DepositSelect | null
  /**
   * The data needed to update a Deposit.
  **/
  data: DepositUpdateInput
  /**
   * Choose, which Deposit to update.
  **/
  where: DepositWhereUniqueInput
}


/**
 * Deposit updateMany
 */
export type DepositUpdateManyArgs = {
  data: DepositUpdateManyMutationInput
  where?: DepositWhereInput
}


/**
 * Deposit upsert
 */
export type DepositUpsertArgs = {
  /**
   * Select specific fields to fetch from the Deposit
  **/
  select?: DepositSelect | null
  /**
   * The filter to search for the Deposit to update in case it exists.
  **/
  where: DepositWhereUniqueInput
  /**
   * In case the Deposit found by the `where` argument doesn't exist, create a new Deposit with this data.
  **/
  create: DepositCreateInput
  /**
   * In case the Deposit was found with the provided `where` argument, update it with this data.
  **/
  update: DepositUpdateInput
}


/**
 * Deposit delete
 */
export type DepositDeleteArgs = {
  /**
   * Select specific fields to fetch from the Deposit
  **/
  select?: DepositSelect | null
  /**
   * Filter which Deposit to delete.
  **/
  where: DepositWhereUniqueInput
}


/**
 * Deposit deleteMany
 */
export type DepositDeleteManyArgs = {
  where?: DepositWhereInput
}


/**
 * Deposit without action
 */
export type DepositArgs = {
  /**
   * Select specific fields to fetch from the Deposit
  **/
  select?: DepositSelect | null
}



/**
 * Model Utxo
 */

export type Utxo = {
  hash: string
  eth: string | null
  owner: string | null
  salt: string | null
  tokenAddr: string | null
  erc20Amount: string | null
  nft: string | null
  status: number | null
  treeId: string | null
  index: string | null
  nullifier: string | null
  usedAt: string | null
}


export type AggregateUtxo = {
  count: number
  avg: UtxoAvgAggregateOutputType | null
  sum: UtxoSumAggregateOutputType | null
  min: UtxoMinAggregateOutputType | null
  max: UtxoMaxAggregateOutputType | null
}

export type UtxoAvgAggregateOutputType = {
  status: number
}

export type UtxoSumAggregateOutputType = {
  status: number | null
}

export type UtxoMinAggregateOutputType = {
  status: number | null
}

export type UtxoMaxAggregateOutputType = {
  status: number | null
}


export type UtxoAvgAggregateInputType = {
  status?: true
}

export type UtxoSumAggregateInputType = {
  status?: true
}

export type UtxoMinAggregateInputType = {
  status?: true
}

export type UtxoMaxAggregateInputType = {
  status?: true
}

export type AggregateUtxoArgs = {
  where?: UtxoWhereInput
  orderBy?: Enumerable<UtxoOrderByInput>
  cursor?: UtxoWhereUniqueInput
  take?: number
  skip?: number
  distinct?: Enumerable<UtxoDistinctFieldEnum>
  count?: true
  avg?: UtxoAvgAggregateInputType
  sum?: UtxoSumAggregateInputType
  min?: UtxoMinAggregateInputType
  max?: UtxoMaxAggregateInputType
}

export type GetUtxoAggregateType<T extends AggregateUtxoArgs> = {
  [P in keyof T]: P extends 'count' ? number : GetUtxoAggregateScalarType<T[P]>
}

export type GetUtxoAggregateScalarType<T extends any> = {
  [P in keyof T]: P extends keyof UtxoAvgAggregateOutputType ? UtxoAvgAggregateOutputType[P] : never
}
    
    

export type UtxoSelect = {
  hash?: boolean
  eth?: boolean
  owner?: boolean
  salt?: boolean
  tokenAddr?: boolean
  erc20Amount?: boolean
  nft?: boolean
  status?: boolean
  treeId?: boolean
  index?: boolean
  nullifier?: boolean
  usedAt?: boolean
}

export type UtxoGetPayload<
  S extends boolean | null | undefined | UtxoArgs,
  U = keyof S
> = S extends true
  ? Utxo
  : S extends undefined
  ? never
  : S extends UtxoArgs | FindManyUtxoArgs
  ? 'include' extends U
    ? Utxo 
  : 'select' extends U
    ? {
      [P in TrueKeys<S['select']>]:P extends keyof Utxo ? Utxo[P]
: 
 never
    }
  : Utxo
: Utxo


export interface UtxoDelegate {
  /**
   * Find zero or one Utxo.
   * @param {FindOneUtxoArgs} args - Arguments to find a Utxo
   * @example
   * // Get one Utxo
   * const utxo = await prisma.utxo.findOne({
   *   where: {
   *     // ... provide filter here
   *   }
   * })
  **/
  findOne<T extends FindOneUtxoArgs>(
    args: Subset<T, FindOneUtxoArgs>
  ): CheckSelect<T, Prisma__UtxoClient<Utxo | null>, Prisma__UtxoClient<UtxoGetPayload<T> | null>>
  /**
   * Find zero or more Utxos.
   * @param {FindManyUtxoArgs=} args - Arguments to filter and select certain fields only.
   * @example
   * // Get all Utxos
   * const utxos = await prisma.utxo.findMany()
   * 
   * // Get first 10 Utxos
   * const utxos = await prisma.utxo.findMany({ take: 10 })
   * 
   * // Only select the `hash`
   * const utxoWithHashOnly = await prisma.utxo.findMany({ select: { hash: true } })
   * 
  **/
  findMany<T extends FindManyUtxoArgs>(
    args?: Subset<T, FindManyUtxoArgs>
  ): CheckSelect<T, Promise<Array<Utxo>>, Promise<Array<UtxoGetPayload<T>>>>
  /**
   * Create a Utxo.
   * @param {UtxoCreateArgs} args - Arguments to create a Utxo.
   * @example
   * // Create one Utxo
   * const Utxo = await prisma.utxo.create({
   *   data: {
   *     // ... data to create a Utxo
   *   }
   * })
   * 
  **/
  create<T extends UtxoCreateArgs>(
    args: Subset<T, UtxoCreateArgs>
  ): CheckSelect<T, Prisma__UtxoClient<Utxo>, Prisma__UtxoClient<UtxoGetPayload<T>>>
  /**
   * Delete a Utxo.
   * @param {UtxoDeleteArgs} args - Arguments to delete one Utxo.
   * @example
   * // Delete one Utxo
   * const Utxo = await prisma.utxo.delete({
   *   where: {
   *     // ... filter to delete one Utxo
   *   }
   * })
   * 
  **/
  delete<T extends UtxoDeleteArgs>(
    args: Subset<T, UtxoDeleteArgs>
  ): CheckSelect<T, Prisma__UtxoClient<Utxo>, Prisma__UtxoClient<UtxoGetPayload<T>>>
  /**
   * Update one Utxo.
   * @param {UtxoUpdateArgs} args - Arguments to update one Utxo.
   * @example
   * // Update one Utxo
   * const utxo = await prisma.utxo.update({
   *   where: {
   *     // ... provide filter here
   *   },
   *   data: {
   *     // ... provide data here
   *   }
   * })
   * 
  **/
  update<T extends UtxoUpdateArgs>(
    args: Subset<T, UtxoUpdateArgs>
  ): CheckSelect<T, Prisma__UtxoClient<Utxo>, Prisma__UtxoClient<UtxoGetPayload<T>>>
  /**
   * Delete zero or more Utxos.
   * @param {UtxoDeleteManyArgs} args - Arguments to filter Utxos to delete.
   * @example
   * // Delete a few Utxos
   * const { count } = await prisma.utxo.deleteMany({
   *   where: {
   *     // ... provide filter here
   *   }
   * })
   * 
  **/
  deleteMany<T extends UtxoDeleteManyArgs>(
    args: Subset<T, UtxoDeleteManyArgs>
  ): Promise<BatchPayload>
  /**
   * Update zero or more Utxos.
   * @param {UtxoUpdateManyArgs} args - Arguments to update one or more rows.
   * @example
   * // Update many Utxos
   * const utxo = await prisma.utxo.updateMany({
   *   where: {
   *     // ... provide filter here
   *   },
   *   data: {
   *     // ... provide data here
   *   }
   * })
   * 
  **/
  updateMany<T extends UtxoUpdateManyArgs>(
    args: Subset<T, UtxoUpdateManyArgs>
  ): Promise<BatchPayload>
  /**
   * Create or update one Utxo.
   * @param {UtxoUpsertArgs} args - Arguments to update or create a Utxo.
   * @example
   * // Update or create a Utxo
   * const utxo = await prisma.utxo.upsert({
   *   create: {
   *     // ... data to create a Utxo
   *   },
   *   update: {
   *     // ... in case it already exists, update
   *   },
   *   where: {
   *     // ... the filter for the Utxo we want to update
   *   }
   * })
  **/
  upsert<T extends UtxoUpsertArgs>(
    args: Subset<T, UtxoUpsertArgs>
  ): CheckSelect<T, Prisma__UtxoClient<Utxo>, Prisma__UtxoClient<UtxoGetPayload<T>>>
  /**
   * Count
   */
  count(args?: Omit<FindManyUtxoArgs, 'select' | 'include'>): Promise<number>

  /**
   * Aggregate
   */
  aggregate<T extends AggregateUtxoArgs>(args: Subset<T, AggregateUtxoArgs>): Promise<GetUtxoAggregateType<T>>
}

/**
 * The delegate class that acts as a "Promise-like" for Utxo.
 * Why is this prefixed with `Prisma__`?
 * Because we want to prevent naming conflicts as mentioned in 
 * https://github.com/prisma/prisma-client-js/issues/707
 */
export declare class Prisma__UtxoClient<T> implements Promise<T> {
  private readonly _dmmf;
  private readonly _fetcher;
  private readonly _queryType;
  private readonly _rootField;
  private readonly _clientMethod;
  private readonly _args;
  private readonly _dataPath;
  private readonly _errorFormat;
  private readonly _measurePerformance?;
  private _isList;
  private _callsite;
  private _requestPromise?;
  constructor(_dmmf: DMMFClass, _fetcher: PrismaClientFetcher, _queryType: 'query' | 'mutation', _rootField: string, _clientMethod: string, _args: any, _dataPath: string[], _errorFormat: ErrorFormat, _measurePerformance?: boolean | undefined, _isList?: boolean);
  readonly [Symbol.toStringTag]: 'PrismaClientPromise';


  private get _document();
  /**
   * Attaches callbacks for the resolution and/or rejection of the Promise.
   * @param onfulfilled The callback to execute when the Promise is resolved.
   * @param onrejected The callback to execute when the Promise is rejected.
   * @returns A Promise for the completion of which ever callback is executed.
   */
  then<TResult1 = T, TResult2 = never>(onfulfilled?: ((value: T) => TResult1 | Promise<TResult1>) | undefined | null, onrejected?: ((reason: any) => TResult2 | Promise<TResult2>) | undefined | null): Promise<TResult1 | TResult2>;
  /**
   * Attaches a callback for only the rejection of the Promise.
   * @param onrejected The callback to execute when the Promise is rejected.
   * @returns A Promise for the completion of the callback.
   */
  catch<TResult = never>(onrejected?: ((reason: any) => TResult | Promise<TResult>) | undefined | null): Promise<T | TResult>;
  /**
   * Attaches a callback that is invoked when the Promise is settled (fulfilled or rejected). The
   * resolved value cannot be modified from the callback.
   * @param onfinally The callback to execute when the Promise is settled (fulfilled or rejected).
   * @returns A Promise for the completion of the callback.
   */
  finally(onfinally?: (() => void) | undefined | null): Promise<T>;
}

// Custom InputTypes

/**
 * Utxo findOne
 */
export type FindOneUtxoArgs = {
  /**
   * Select specific fields to fetch from the Utxo
  **/
  select?: UtxoSelect | null
  /**
   * Filter, which Utxo to fetch.
  **/
  where: UtxoWhereUniqueInput
}


/**
 * Utxo findMany
 */
export type FindManyUtxoArgs = {
  /**
   * Select specific fields to fetch from the Utxo
  **/
  select?: UtxoSelect | null
  /**
   * Filter, which Utxos to fetch.
  **/
  where?: UtxoWhereInput
  /**
   * Determine the order of the Utxos to fetch.
  **/
  orderBy?: Enumerable<UtxoOrderByInput>
  /**
   * Sets the position for listing Utxos.
  **/
  cursor?: UtxoWhereUniqueInput
  /**
   * The number of Utxos to fetch. If negative number, it will take Utxos before the `cursor`.
  **/
  take?: number
  /**
   * Skip the first `n` Utxos.
  **/
  skip?: number
  distinct?: Enumerable<UtxoDistinctFieldEnum>
}


/**
 * Utxo create
 */
export type UtxoCreateArgs = {
  /**
   * Select specific fields to fetch from the Utxo
  **/
  select?: UtxoSelect | null
  /**
   * The data needed to create a Utxo.
  **/
  data: UtxoCreateInput
}


/**
 * Utxo update
 */
export type UtxoUpdateArgs = {
  /**
   * Select specific fields to fetch from the Utxo
  **/
  select?: UtxoSelect | null
  /**
   * The data needed to update a Utxo.
  **/
  data: UtxoUpdateInput
  /**
   * Choose, which Utxo to update.
  **/
  where: UtxoWhereUniqueInput
}


/**
 * Utxo updateMany
 */
export type UtxoUpdateManyArgs = {
  data: UtxoUpdateManyMutationInput
  where?: UtxoWhereInput
}


/**
 * Utxo upsert
 */
export type UtxoUpsertArgs = {
  /**
   * Select specific fields to fetch from the Utxo
  **/
  select?: UtxoSelect | null
  /**
   * The filter to search for the Utxo to update in case it exists.
  **/
  where: UtxoWhereUniqueInput
  /**
   * In case the Utxo found by the `where` argument doesn't exist, create a new Utxo with this data.
  **/
  create: UtxoCreateInput
  /**
   * In case the Utxo was found with the provided `where` argument, update it with this data.
  **/
  update: UtxoUpdateInput
}


/**
 * Utxo delete
 */
export type UtxoDeleteArgs = {
  /**
   * Select specific fields to fetch from the Utxo
  **/
  select?: UtxoSelect | null
  /**
   * Filter which Utxo to delete.
  **/
  where: UtxoWhereUniqueInput
}


/**
 * Utxo deleteMany
 */
export type UtxoDeleteManyArgs = {
  where?: UtxoWhereInput
}


/**
 * Utxo without action
 */
export type UtxoArgs = {
  /**
   * Select specific fields to fetch from the Utxo
  **/
  select?: UtxoSelect | null
}



/**
 * Model Withdrawal
 */

export type Withdrawal = {
  hash: string
  withdrawalHash: string
  eth: string
  owner: string | null
  salt: string | null
  tokenAddr: string
  erc20Amount: string
  nft: string
  to: string
  fee: string
  status: number | null
  treeId: string | null
  index: string | null
  includedIn: string | null
  prepayer: string | null
  siblings: string | null
}


export type AggregateWithdrawal = {
  count: number
  avg: WithdrawalAvgAggregateOutputType | null
  sum: WithdrawalSumAggregateOutputType | null
  min: WithdrawalMinAggregateOutputType | null
  max: WithdrawalMaxAggregateOutputType | null
}

export type WithdrawalAvgAggregateOutputType = {
  status: number
}

export type WithdrawalSumAggregateOutputType = {
  status: number | null
}

export type WithdrawalMinAggregateOutputType = {
  status: number | null
}

export type WithdrawalMaxAggregateOutputType = {
  status: number | null
}


export type WithdrawalAvgAggregateInputType = {
  status?: true
}

export type WithdrawalSumAggregateInputType = {
  status?: true
}

export type WithdrawalMinAggregateInputType = {
  status?: true
}

export type WithdrawalMaxAggregateInputType = {
  status?: true
}

export type AggregateWithdrawalArgs = {
  where?: WithdrawalWhereInput
  orderBy?: Enumerable<WithdrawalOrderByInput>
  cursor?: WithdrawalWhereUniqueInput
  take?: number
  skip?: number
  distinct?: Enumerable<WithdrawalDistinctFieldEnum>
  count?: true
  avg?: WithdrawalAvgAggregateInputType
  sum?: WithdrawalSumAggregateInputType
  min?: WithdrawalMinAggregateInputType
  max?: WithdrawalMaxAggregateInputType
}

export type GetWithdrawalAggregateType<T extends AggregateWithdrawalArgs> = {
  [P in keyof T]: P extends 'count' ? number : GetWithdrawalAggregateScalarType<T[P]>
}

export type GetWithdrawalAggregateScalarType<T extends any> = {
  [P in keyof T]: P extends keyof WithdrawalAvgAggregateOutputType ? WithdrawalAvgAggregateOutputType[P] : never
}
    
    

export type WithdrawalSelect = {
  hash?: boolean
  withdrawalHash?: boolean
  eth?: boolean
  owner?: boolean
  salt?: boolean
  tokenAddr?: boolean
  erc20Amount?: boolean
  nft?: boolean
  to?: boolean
  fee?: boolean
  status?: boolean
  treeId?: boolean
  index?: boolean
  includedIn?: boolean
  prepayer?: boolean
  siblings?: boolean
}

export type WithdrawalGetPayload<
  S extends boolean | null | undefined | WithdrawalArgs,
  U = keyof S
> = S extends true
  ? Withdrawal
  : S extends undefined
  ? never
  : S extends WithdrawalArgs | FindManyWithdrawalArgs
  ? 'include' extends U
    ? Withdrawal 
  : 'select' extends U
    ? {
      [P in TrueKeys<S['select']>]:P extends keyof Withdrawal ? Withdrawal[P]
: 
 never
    }
  : Withdrawal
: Withdrawal


export interface WithdrawalDelegate {
  /**
   * Find zero or one Withdrawal.
   * @param {FindOneWithdrawalArgs} args - Arguments to find a Withdrawal
   * @example
   * // Get one Withdrawal
   * const withdrawal = await prisma.withdrawal.findOne({
   *   where: {
   *     // ... provide filter here
   *   }
   * })
  **/
  findOne<T extends FindOneWithdrawalArgs>(
    args: Subset<T, FindOneWithdrawalArgs>
  ): CheckSelect<T, Prisma__WithdrawalClient<Withdrawal | null>, Prisma__WithdrawalClient<WithdrawalGetPayload<T> | null>>
  /**
   * Find zero or more Withdrawals.
   * @param {FindManyWithdrawalArgs=} args - Arguments to filter and select certain fields only.
   * @example
   * // Get all Withdrawals
   * const withdrawals = await prisma.withdrawal.findMany()
   * 
   * // Get first 10 Withdrawals
   * const withdrawals = await prisma.withdrawal.findMany({ take: 10 })
   * 
   * // Only select the `hash`
   * const withdrawalWithHashOnly = await prisma.withdrawal.findMany({ select: { hash: true } })
   * 
  **/
  findMany<T extends FindManyWithdrawalArgs>(
    args?: Subset<T, FindManyWithdrawalArgs>
  ): CheckSelect<T, Promise<Array<Withdrawal>>, Promise<Array<WithdrawalGetPayload<T>>>>
  /**
   * Create a Withdrawal.
   * @param {WithdrawalCreateArgs} args - Arguments to create a Withdrawal.
   * @example
   * // Create one Withdrawal
   * const Withdrawal = await prisma.withdrawal.create({
   *   data: {
   *     // ... data to create a Withdrawal
   *   }
   * })
   * 
  **/
  create<T extends WithdrawalCreateArgs>(
    args: Subset<T, WithdrawalCreateArgs>
  ): CheckSelect<T, Prisma__WithdrawalClient<Withdrawal>, Prisma__WithdrawalClient<WithdrawalGetPayload<T>>>
  /**
   * Delete a Withdrawal.
   * @param {WithdrawalDeleteArgs} args - Arguments to delete one Withdrawal.
   * @example
   * // Delete one Withdrawal
   * const Withdrawal = await prisma.withdrawal.delete({
   *   where: {
   *     // ... filter to delete one Withdrawal
   *   }
   * })
   * 
  **/
  delete<T extends WithdrawalDeleteArgs>(
    args: Subset<T, WithdrawalDeleteArgs>
  ): CheckSelect<T, Prisma__WithdrawalClient<Withdrawal>, Prisma__WithdrawalClient<WithdrawalGetPayload<T>>>
  /**
   * Update one Withdrawal.
   * @param {WithdrawalUpdateArgs} args - Arguments to update one Withdrawal.
   * @example
   * // Update one Withdrawal
   * const withdrawal = await prisma.withdrawal.update({
   *   where: {
   *     // ... provide filter here
   *   },
   *   data: {
   *     // ... provide data here
   *   }
   * })
   * 
  **/
  update<T extends WithdrawalUpdateArgs>(
    args: Subset<T, WithdrawalUpdateArgs>
  ): CheckSelect<T, Prisma__WithdrawalClient<Withdrawal>, Prisma__WithdrawalClient<WithdrawalGetPayload<T>>>
  /**
   * Delete zero or more Withdrawals.
   * @param {WithdrawalDeleteManyArgs} args - Arguments to filter Withdrawals to delete.
   * @example
   * // Delete a few Withdrawals
   * const { count } = await prisma.withdrawal.deleteMany({
   *   where: {
   *     // ... provide filter here
   *   }
   * })
   * 
  **/
  deleteMany<T extends WithdrawalDeleteManyArgs>(
    args: Subset<T, WithdrawalDeleteManyArgs>
  ): Promise<BatchPayload>
  /**
   * Update zero or more Withdrawals.
   * @param {WithdrawalUpdateManyArgs} args - Arguments to update one or more rows.
   * @example
   * // Update many Withdrawals
   * const withdrawal = await prisma.withdrawal.updateMany({
   *   where: {
   *     // ... provide filter here
   *   },
   *   data: {
   *     // ... provide data here
   *   }
   * })
   * 
  **/
  updateMany<T extends WithdrawalUpdateManyArgs>(
    args: Subset<T, WithdrawalUpdateManyArgs>
  ): Promise<BatchPayload>
  /**
   * Create or update one Withdrawal.
   * @param {WithdrawalUpsertArgs} args - Arguments to update or create a Withdrawal.
   * @example
   * // Update or create a Withdrawal
   * const withdrawal = await prisma.withdrawal.upsert({
   *   create: {
   *     // ... data to create a Withdrawal
   *   },
   *   update: {
   *     // ... in case it already exists, update
   *   },
   *   where: {
   *     // ... the filter for the Withdrawal we want to update
   *   }
   * })
  **/
  upsert<T extends WithdrawalUpsertArgs>(
    args: Subset<T, WithdrawalUpsertArgs>
  ): CheckSelect<T, Prisma__WithdrawalClient<Withdrawal>, Prisma__WithdrawalClient<WithdrawalGetPayload<T>>>
  /**
   * Count
   */
  count(args?: Omit<FindManyWithdrawalArgs, 'select' | 'include'>): Promise<number>

  /**
   * Aggregate
   */
  aggregate<T extends AggregateWithdrawalArgs>(args: Subset<T, AggregateWithdrawalArgs>): Promise<GetWithdrawalAggregateType<T>>
}

/**
 * The delegate class that acts as a "Promise-like" for Withdrawal.
 * Why is this prefixed with `Prisma__`?
 * Because we want to prevent naming conflicts as mentioned in 
 * https://github.com/prisma/prisma-client-js/issues/707
 */
export declare class Prisma__WithdrawalClient<T> implements Promise<T> {
  private readonly _dmmf;
  private readonly _fetcher;
  private readonly _queryType;
  private readonly _rootField;
  private readonly _clientMethod;
  private readonly _args;
  private readonly _dataPath;
  private readonly _errorFormat;
  private readonly _measurePerformance?;
  private _isList;
  private _callsite;
  private _requestPromise?;
  constructor(_dmmf: DMMFClass, _fetcher: PrismaClientFetcher, _queryType: 'query' | 'mutation', _rootField: string, _clientMethod: string, _args: any, _dataPath: string[], _errorFormat: ErrorFormat, _measurePerformance?: boolean | undefined, _isList?: boolean);
  readonly [Symbol.toStringTag]: 'PrismaClientPromise';


  private get _document();
  /**
   * Attaches callbacks for the resolution and/or rejection of the Promise.
   * @param onfulfilled The callback to execute when the Promise is resolved.
   * @param onrejected The callback to execute when the Promise is rejected.
   * @returns A Promise for the completion of which ever callback is executed.
   */
  then<TResult1 = T, TResult2 = never>(onfulfilled?: ((value: T) => TResult1 | Promise<TResult1>) | undefined | null, onrejected?: ((reason: any) => TResult2 | Promise<TResult2>) | undefined | null): Promise<TResult1 | TResult2>;
  /**
   * Attaches a callback for only the rejection of the Promise.
   * @param onrejected The callback to execute when the Promise is rejected.
   * @returns A Promise for the completion of the callback.
   */
  catch<TResult = never>(onrejected?: ((reason: any) => TResult | Promise<TResult>) | undefined | null): Promise<T | TResult>;
  /**
   * Attaches a callback that is invoked when the Promise is settled (fulfilled or rejected). The
   * resolved value cannot be modified from the callback.
   * @param onfinally The callback to execute when the Promise is settled (fulfilled or rejected).
   * @returns A Promise for the completion of the callback.
   */
  finally(onfinally?: (() => void) | undefined | null): Promise<T>;
}

// Custom InputTypes

/**
 * Withdrawal findOne
 */
export type FindOneWithdrawalArgs = {
  /**
   * Select specific fields to fetch from the Withdrawal
  **/
  select?: WithdrawalSelect | null
  /**
   * Filter, which Withdrawal to fetch.
  **/
  where: WithdrawalWhereUniqueInput
}


/**
 * Withdrawal findMany
 */
export type FindManyWithdrawalArgs = {
  /**
   * Select specific fields to fetch from the Withdrawal
  **/
  select?: WithdrawalSelect | null
  /**
   * Filter, which Withdrawals to fetch.
  **/
  where?: WithdrawalWhereInput
  /**
   * Determine the order of the Withdrawals to fetch.
  **/
  orderBy?: Enumerable<WithdrawalOrderByInput>
  /**
   * Sets the position for listing Withdrawals.
  **/
  cursor?: WithdrawalWhereUniqueInput
  /**
   * The number of Withdrawals to fetch. If negative number, it will take Withdrawals before the `cursor`.
  **/
  take?: number
  /**
   * Skip the first `n` Withdrawals.
  **/
  skip?: number
  distinct?: Enumerable<WithdrawalDistinctFieldEnum>
}


/**
 * Withdrawal create
 */
export type WithdrawalCreateArgs = {
  /**
   * Select specific fields to fetch from the Withdrawal
  **/
  select?: WithdrawalSelect | null
  /**
   * The data needed to create a Withdrawal.
  **/
  data: WithdrawalCreateInput
}


/**
 * Withdrawal update
 */
export type WithdrawalUpdateArgs = {
  /**
   * Select specific fields to fetch from the Withdrawal
  **/
  select?: WithdrawalSelect | null
  /**
   * The data needed to update a Withdrawal.
  **/
  data: WithdrawalUpdateInput
  /**
   * Choose, which Withdrawal to update.
  **/
  where: WithdrawalWhereUniqueInput
}


/**
 * Withdrawal updateMany
 */
export type WithdrawalUpdateManyArgs = {
  data: WithdrawalUpdateManyMutationInput
  where?: WithdrawalWhereInput
}


/**
 * Withdrawal upsert
 */
export type WithdrawalUpsertArgs = {
  /**
   * Select specific fields to fetch from the Withdrawal
  **/
  select?: WithdrawalSelect | null
  /**
   * The filter to search for the Withdrawal to update in case it exists.
  **/
  where: WithdrawalWhereUniqueInput
  /**
   * In case the Withdrawal found by the `where` argument doesn't exist, create a new Withdrawal with this data.
  **/
  create: WithdrawalCreateInput
  /**
   * In case the Withdrawal was found with the provided `where` argument, update it with this data.
  **/
  update: WithdrawalUpdateInput
}


/**
 * Withdrawal delete
 */
export type WithdrawalDeleteArgs = {
  /**
   * Select specific fields to fetch from the Withdrawal
  **/
  select?: WithdrawalSelect | null
  /**
   * Filter which Withdrawal to delete.
  **/
  where: WithdrawalWhereUniqueInput
}


/**
 * Withdrawal deleteMany
 */
export type WithdrawalDeleteManyArgs = {
  where?: WithdrawalWhereInput
}


/**
 * Withdrawal without action
 */
export type WithdrawalArgs = {
  /**
   * Select specific fields to fetch from the Withdrawal
  **/
  select?: WithdrawalSelect | null
}



/**
 * Model Migration
 */

export type Migration = {
  hash: string
  eth: string | null
  owner: string | null
  salt: string | null
  tokenAddr: string | null
  erc20Amount: string | null
  nft: string | null
  to: string | null
  fee: string | null
  status: number | null
  treeId: string | null
  index: string | null
  usedFor: string | null
}


export type AggregateMigration = {
  count: number
  avg: MigrationAvgAggregateOutputType | null
  sum: MigrationSumAggregateOutputType | null
  min: MigrationMinAggregateOutputType | null
  max: MigrationMaxAggregateOutputType | null
}

export type MigrationAvgAggregateOutputType = {
  status: number
}

export type MigrationSumAggregateOutputType = {
  status: number | null
}

export type MigrationMinAggregateOutputType = {
  status: number | null
}

export type MigrationMaxAggregateOutputType = {
  status: number | null
}


export type MigrationAvgAggregateInputType = {
  status?: true
}

export type MigrationSumAggregateInputType = {
  status?: true
}

export type MigrationMinAggregateInputType = {
  status?: true
}

export type MigrationMaxAggregateInputType = {
  status?: true
}

export type AggregateMigrationArgs = {
  where?: MigrationWhereInput
  orderBy?: Enumerable<MigrationOrderByInput>
  cursor?: MigrationWhereUniqueInput
  take?: number
  skip?: number
  distinct?: Enumerable<MigrationDistinctFieldEnum>
  count?: true
  avg?: MigrationAvgAggregateInputType
  sum?: MigrationSumAggregateInputType
  min?: MigrationMinAggregateInputType
  max?: MigrationMaxAggregateInputType
}

export type GetMigrationAggregateType<T extends AggregateMigrationArgs> = {
  [P in keyof T]: P extends 'count' ? number : GetMigrationAggregateScalarType<T[P]>
}

export type GetMigrationAggregateScalarType<T extends any> = {
  [P in keyof T]: P extends keyof MigrationAvgAggregateOutputType ? MigrationAvgAggregateOutputType[P] : never
}
    
    

export type MigrationSelect = {
  hash?: boolean
  eth?: boolean
  owner?: boolean
  salt?: boolean
  tokenAddr?: boolean
  erc20Amount?: boolean
  nft?: boolean
  to?: boolean
  fee?: boolean
  status?: boolean
  treeId?: boolean
  index?: boolean
  usedFor?: boolean
}

export type MigrationGetPayload<
  S extends boolean | null | undefined | MigrationArgs,
  U = keyof S
> = S extends true
  ? Migration
  : S extends undefined
  ? never
  : S extends MigrationArgs | FindManyMigrationArgs
  ? 'include' extends U
    ? Migration 
  : 'select' extends U
    ? {
      [P in TrueKeys<S['select']>]:P extends keyof Migration ? Migration[P]
: 
 never
    }
  : Migration
: Migration


export interface MigrationDelegate {
  /**
   * Find zero or one Migration.
   * @param {FindOneMigrationArgs} args - Arguments to find a Migration
   * @example
   * // Get one Migration
   * const migration = await prisma.migration.findOne({
   *   where: {
   *     // ... provide filter here
   *   }
   * })
  **/
  findOne<T extends FindOneMigrationArgs>(
    args: Subset<T, FindOneMigrationArgs>
  ): CheckSelect<T, Prisma__MigrationClient<Migration | null>, Prisma__MigrationClient<MigrationGetPayload<T> | null>>
  /**
   * Find zero or more Migrations.
   * @param {FindManyMigrationArgs=} args - Arguments to filter and select certain fields only.
   * @example
   * // Get all Migrations
   * const migrations = await prisma.migration.findMany()
   * 
   * // Get first 10 Migrations
   * const migrations = await prisma.migration.findMany({ take: 10 })
   * 
   * // Only select the `hash`
   * const migrationWithHashOnly = await prisma.migration.findMany({ select: { hash: true } })
   * 
  **/
  findMany<T extends FindManyMigrationArgs>(
    args?: Subset<T, FindManyMigrationArgs>
  ): CheckSelect<T, Promise<Array<Migration>>, Promise<Array<MigrationGetPayload<T>>>>
  /**
   * Create a Migration.
   * @param {MigrationCreateArgs} args - Arguments to create a Migration.
   * @example
   * // Create one Migration
   * const Migration = await prisma.migration.create({
   *   data: {
   *     // ... data to create a Migration
   *   }
   * })
   * 
  **/
  create<T extends MigrationCreateArgs>(
    args: Subset<T, MigrationCreateArgs>
  ): CheckSelect<T, Prisma__MigrationClient<Migration>, Prisma__MigrationClient<MigrationGetPayload<T>>>
  /**
   * Delete a Migration.
   * @param {MigrationDeleteArgs} args - Arguments to delete one Migration.
   * @example
   * // Delete one Migration
   * const Migration = await prisma.migration.delete({
   *   where: {
   *     // ... filter to delete one Migration
   *   }
   * })
   * 
  **/
  delete<T extends MigrationDeleteArgs>(
    args: Subset<T, MigrationDeleteArgs>
  ): CheckSelect<T, Prisma__MigrationClient<Migration>, Prisma__MigrationClient<MigrationGetPayload<T>>>
  /**
   * Update one Migration.
   * @param {MigrationUpdateArgs} args - Arguments to update one Migration.
   * @example
   * // Update one Migration
   * const migration = await prisma.migration.update({
   *   where: {
   *     // ... provide filter here
   *   },
   *   data: {
   *     // ... provide data here
   *   }
   * })
   * 
  **/
  update<T extends MigrationUpdateArgs>(
    args: Subset<T, MigrationUpdateArgs>
  ): CheckSelect<T, Prisma__MigrationClient<Migration>, Prisma__MigrationClient<MigrationGetPayload<T>>>
  /**
   * Delete zero or more Migrations.
   * @param {MigrationDeleteManyArgs} args - Arguments to filter Migrations to delete.
   * @example
   * // Delete a few Migrations
   * const { count } = await prisma.migration.deleteMany({
   *   where: {
   *     // ... provide filter here
   *   }
   * })
   * 
  **/
  deleteMany<T extends MigrationDeleteManyArgs>(
    args: Subset<T, MigrationDeleteManyArgs>
  ): Promise<BatchPayload>
  /**
   * Update zero or more Migrations.
   * @param {MigrationUpdateManyArgs} args - Arguments to update one or more rows.
   * @example
   * // Update many Migrations
   * const migration = await prisma.migration.updateMany({
   *   where: {
   *     // ... provide filter here
   *   },
   *   data: {
   *     // ... provide data here
   *   }
   * })
   * 
  **/
  updateMany<T extends MigrationUpdateManyArgs>(
    args: Subset<T, MigrationUpdateManyArgs>
  ): Promise<BatchPayload>
  /**
   * Create or update one Migration.
   * @param {MigrationUpsertArgs} args - Arguments to update or create a Migration.
   * @example
   * // Update or create a Migration
   * const migration = await prisma.migration.upsert({
   *   create: {
   *     // ... data to create a Migration
   *   },
   *   update: {
   *     // ... in case it already exists, update
   *   },
   *   where: {
   *     // ... the filter for the Migration we want to update
   *   }
   * })
  **/
  upsert<T extends MigrationUpsertArgs>(
    args: Subset<T, MigrationUpsertArgs>
  ): CheckSelect<T, Prisma__MigrationClient<Migration>, Prisma__MigrationClient<MigrationGetPayload<T>>>
  /**
   * Count
   */
  count(args?: Omit<FindManyMigrationArgs, 'select' | 'include'>): Promise<number>

  /**
   * Aggregate
   */
  aggregate<T extends AggregateMigrationArgs>(args: Subset<T, AggregateMigrationArgs>): Promise<GetMigrationAggregateType<T>>
}

/**
 * The delegate class that acts as a "Promise-like" for Migration.
 * Why is this prefixed with `Prisma__`?
 * Because we want to prevent naming conflicts as mentioned in 
 * https://github.com/prisma/prisma-client-js/issues/707
 */
export declare class Prisma__MigrationClient<T> implements Promise<T> {
  private readonly _dmmf;
  private readonly _fetcher;
  private readonly _queryType;
  private readonly _rootField;
  private readonly _clientMethod;
  private readonly _args;
  private readonly _dataPath;
  private readonly _errorFormat;
  private readonly _measurePerformance?;
  private _isList;
  private _callsite;
  private _requestPromise?;
  constructor(_dmmf: DMMFClass, _fetcher: PrismaClientFetcher, _queryType: 'query' | 'mutation', _rootField: string, _clientMethod: string, _args: any, _dataPath: string[], _errorFormat: ErrorFormat, _measurePerformance?: boolean | undefined, _isList?: boolean);
  readonly [Symbol.toStringTag]: 'PrismaClientPromise';


  private get _document();
  /**
   * Attaches callbacks for the resolution and/or rejection of the Promise.
   * @param onfulfilled The callback to execute when the Promise is resolved.
   * @param onrejected The callback to execute when the Promise is rejected.
   * @returns A Promise for the completion of which ever callback is executed.
   */
  then<TResult1 = T, TResult2 = never>(onfulfilled?: ((value: T) => TResult1 | Promise<TResult1>) | undefined | null, onrejected?: ((reason: any) => TResult2 | Promise<TResult2>) | undefined | null): Promise<TResult1 | TResult2>;
  /**
   * Attaches a callback for only the rejection of the Promise.
   * @param onrejected The callback to execute when the Promise is rejected.
   * @returns A Promise for the completion of the callback.
   */
  catch<TResult = never>(onrejected?: ((reason: any) => TResult | Promise<TResult>) | undefined | null): Promise<T | TResult>;
  /**
   * Attaches a callback that is invoked when the Promise is settled (fulfilled or rejected). The
   * resolved value cannot be modified from the callback.
   * @param onfinally The callback to execute when the Promise is settled (fulfilled or rejected).
   * @returns A Promise for the completion of the callback.
   */
  finally(onfinally?: (() => void) | undefined | null): Promise<T>;
}

// Custom InputTypes

/**
 * Migration findOne
 */
export type FindOneMigrationArgs = {
  /**
   * Select specific fields to fetch from the Migration
  **/
  select?: MigrationSelect | null
  /**
   * Filter, which Migration to fetch.
  **/
  where: MigrationWhereUniqueInput
}


/**
 * Migration findMany
 */
export type FindManyMigrationArgs = {
  /**
   * Select specific fields to fetch from the Migration
  **/
  select?: MigrationSelect | null
  /**
   * Filter, which Migrations to fetch.
  **/
  where?: MigrationWhereInput
  /**
   * Determine the order of the Migrations to fetch.
  **/
  orderBy?: Enumerable<MigrationOrderByInput>
  /**
   * Sets the position for listing Migrations.
  **/
  cursor?: MigrationWhereUniqueInput
  /**
   * The number of Migrations to fetch. If negative number, it will take Migrations before the `cursor`.
  **/
  take?: number
  /**
   * Skip the first `n` Migrations.
  **/
  skip?: number
  distinct?: Enumerable<MigrationDistinctFieldEnum>
}


/**
 * Migration create
 */
export type MigrationCreateArgs = {
  /**
   * Select specific fields to fetch from the Migration
  **/
  select?: MigrationSelect | null
  /**
   * The data needed to create a Migration.
  **/
  data: MigrationCreateInput
}


/**
 * Migration update
 */
export type MigrationUpdateArgs = {
  /**
   * Select specific fields to fetch from the Migration
  **/
  select?: MigrationSelect | null
  /**
   * The data needed to update a Migration.
  **/
  data: MigrationUpdateInput
  /**
   * Choose, which Migration to update.
  **/
  where: MigrationWhereUniqueInput
}


/**
 * Migration updateMany
 */
export type MigrationUpdateManyArgs = {
  data: MigrationUpdateManyMutationInput
  where?: MigrationWhereInput
}


/**
 * Migration upsert
 */
export type MigrationUpsertArgs = {
  /**
   * Select specific fields to fetch from the Migration
  **/
  select?: MigrationSelect | null
  /**
   * The filter to search for the Migration to update in case it exists.
  **/
  where: MigrationWhereUniqueInput
  /**
   * In case the Migration found by the `where` argument doesn't exist, create a new Migration with this data.
  **/
  create: MigrationCreateInput
  /**
   * In case the Migration was found with the provided `where` argument, update it with this data.
  **/
  update: MigrationUpdateInput
}


/**
 * Migration delete
 */
export type MigrationDeleteArgs = {
  /**
   * Select specific fields to fetch from the Migration
  **/
  select?: MigrationSelect | null
  /**
   * Filter which Migration to delete.
  **/
  where: MigrationWhereUniqueInput
}


/**
 * Migration deleteMany
 */
export type MigrationDeleteManyArgs = {
  where?: MigrationWhereInput
}


/**
 * Migration without action
 */
export type MigrationArgs = {
  /**
   * Select specific fields to fetch from the Migration
  **/
  select?: MigrationSelect | null
}



/**
 * Model TreeNode
 */

export type TreeNode = {
  treeId: string
  nodeIndex: string
  value: string
}


export type AggregateTreeNode = {
  count: number
}



export type AggregateTreeNodeArgs = {
  where?: TreeNodeWhereInput
  orderBy?: Enumerable<TreeNodeOrderByInput>
  cursor?: TreeNodeWhereUniqueInput
  take?: number
  skip?: number
  distinct?: Enumerable<TreeNodeDistinctFieldEnum>
  count?: true
}

export type GetTreeNodeAggregateType<T extends AggregateTreeNodeArgs> = {
  [P in keyof T]: P extends 'count' ? number : never
}


    
    

export type TreeNodeSelect = {
  treeId?: boolean
  nodeIndex?: boolean
  value?: boolean
}

export type TreeNodeGetPayload<
  S extends boolean | null | undefined | TreeNodeArgs,
  U = keyof S
> = S extends true
  ? TreeNode
  : S extends undefined
  ? never
  : S extends TreeNodeArgs | FindManyTreeNodeArgs
  ? 'include' extends U
    ? TreeNode 
  : 'select' extends U
    ? {
      [P in TrueKeys<S['select']>]:P extends keyof TreeNode ? TreeNode[P]
: 
 never
    }
  : TreeNode
: TreeNode


export interface TreeNodeDelegate {
  /**
   * Find zero or one TreeNode.
   * @param {FindOneTreeNodeArgs} args - Arguments to find a TreeNode
   * @example
   * // Get one TreeNode
   * const treeNode = await prisma.treeNode.findOne({
   *   where: {
   *     // ... provide filter here
   *   }
   * })
  **/
  findOne<T extends FindOneTreeNodeArgs>(
    args: Subset<T, FindOneTreeNodeArgs>
  ): CheckSelect<T, Prisma__TreeNodeClient<TreeNode | null>, Prisma__TreeNodeClient<TreeNodeGetPayload<T> | null>>
  /**
   * Find zero or more TreeNodes.
   * @param {FindManyTreeNodeArgs=} args - Arguments to filter and select certain fields only.
   * @example
   * // Get all TreeNodes
   * const treeNodes = await prisma.treeNode.findMany()
   * 
   * // Get first 10 TreeNodes
   * const treeNodes = await prisma.treeNode.findMany({ take: 10 })
   * 
   * // Only select the `treeId`
   * const treeNodeWithTreeIdOnly = await prisma.treeNode.findMany({ select: { treeId: true } })
   * 
  **/
  findMany<T extends FindManyTreeNodeArgs>(
    args?: Subset<T, FindManyTreeNodeArgs>
  ): CheckSelect<T, Promise<Array<TreeNode>>, Promise<Array<TreeNodeGetPayload<T>>>>
  /**
   * Create a TreeNode.
   * @param {TreeNodeCreateArgs} args - Arguments to create a TreeNode.
   * @example
   * // Create one TreeNode
   * const TreeNode = await prisma.treeNode.create({
   *   data: {
   *     // ... data to create a TreeNode
   *   }
   * })
   * 
  **/
  create<T extends TreeNodeCreateArgs>(
    args: Subset<T, TreeNodeCreateArgs>
  ): CheckSelect<T, Prisma__TreeNodeClient<TreeNode>, Prisma__TreeNodeClient<TreeNodeGetPayload<T>>>
  /**
   * Delete a TreeNode.
   * @param {TreeNodeDeleteArgs} args - Arguments to delete one TreeNode.
   * @example
   * // Delete one TreeNode
   * const TreeNode = await prisma.treeNode.delete({
   *   where: {
   *     // ... filter to delete one TreeNode
   *   }
   * })
   * 
  **/
  delete<T extends TreeNodeDeleteArgs>(
    args: Subset<T, TreeNodeDeleteArgs>
  ): CheckSelect<T, Prisma__TreeNodeClient<TreeNode>, Prisma__TreeNodeClient<TreeNodeGetPayload<T>>>
  /**
   * Update one TreeNode.
   * @param {TreeNodeUpdateArgs} args - Arguments to update one TreeNode.
   * @example
   * // Update one TreeNode
   * const treeNode = await prisma.treeNode.update({
   *   where: {
   *     // ... provide filter here
   *   },
   *   data: {
   *     // ... provide data here
   *   }
   * })
   * 
  **/
  update<T extends TreeNodeUpdateArgs>(
    args: Subset<T, TreeNodeUpdateArgs>
  ): CheckSelect<T, Prisma__TreeNodeClient<TreeNode>, Prisma__TreeNodeClient<TreeNodeGetPayload<T>>>
  /**
   * Delete zero or more TreeNodes.
   * @param {TreeNodeDeleteManyArgs} args - Arguments to filter TreeNodes to delete.
   * @example
   * // Delete a few TreeNodes
   * const { count } = await prisma.treeNode.deleteMany({
   *   where: {
   *     // ... provide filter here
   *   }
   * })
   * 
  **/
  deleteMany<T extends TreeNodeDeleteManyArgs>(
    args: Subset<T, TreeNodeDeleteManyArgs>
  ): Promise<BatchPayload>
  /**
   * Update zero or more TreeNodes.
   * @param {TreeNodeUpdateManyArgs} args - Arguments to update one or more rows.
   * @example
   * // Update many TreeNodes
   * const treeNode = await prisma.treeNode.updateMany({
   *   where: {
   *     // ... provide filter here
   *   },
   *   data: {
   *     // ... provide data here
   *   }
   * })
   * 
  **/
  updateMany<T extends TreeNodeUpdateManyArgs>(
    args: Subset<T, TreeNodeUpdateManyArgs>
  ): Promise<BatchPayload>
  /**
   * Create or update one TreeNode.
   * @param {TreeNodeUpsertArgs} args - Arguments to update or create a TreeNode.
   * @example
   * // Update or create a TreeNode
   * const treeNode = await prisma.treeNode.upsert({
   *   create: {
   *     // ... data to create a TreeNode
   *   },
   *   update: {
   *     // ... in case it already exists, update
   *   },
   *   where: {
   *     // ... the filter for the TreeNode we want to update
   *   }
   * })
  **/
  upsert<T extends TreeNodeUpsertArgs>(
    args: Subset<T, TreeNodeUpsertArgs>
  ): CheckSelect<T, Prisma__TreeNodeClient<TreeNode>, Prisma__TreeNodeClient<TreeNodeGetPayload<T>>>
  /**
   * Count
   */
  count(args?: Omit<FindManyTreeNodeArgs, 'select' | 'include'>): Promise<number>

  /**
   * Aggregate
   */
  aggregate<T extends AggregateTreeNodeArgs>(args: Subset<T, AggregateTreeNodeArgs>): Promise<GetTreeNodeAggregateType<T>>
}

/**
 * The delegate class that acts as a "Promise-like" for TreeNode.
 * Why is this prefixed with `Prisma__`?
 * Because we want to prevent naming conflicts as mentioned in 
 * https://github.com/prisma/prisma-client-js/issues/707
 */
export declare class Prisma__TreeNodeClient<T> implements Promise<T> {
  private readonly _dmmf;
  private readonly _fetcher;
  private readonly _queryType;
  private readonly _rootField;
  private readonly _clientMethod;
  private readonly _args;
  private readonly _dataPath;
  private readonly _errorFormat;
  private readonly _measurePerformance?;
  private _isList;
  private _callsite;
  private _requestPromise?;
  constructor(_dmmf: DMMFClass, _fetcher: PrismaClientFetcher, _queryType: 'query' | 'mutation', _rootField: string, _clientMethod: string, _args: any, _dataPath: string[], _errorFormat: ErrorFormat, _measurePerformance?: boolean | undefined, _isList?: boolean);
  readonly [Symbol.toStringTag]: 'PrismaClientPromise';


  private get _document();
  /**
   * Attaches callbacks for the resolution and/or rejection of the Promise.
   * @param onfulfilled The callback to execute when the Promise is resolved.
   * @param onrejected The callback to execute when the Promise is rejected.
   * @returns A Promise for the completion of which ever callback is executed.
   */
  then<TResult1 = T, TResult2 = never>(onfulfilled?: ((value: T) => TResult1 | Promise<TResult1>) | undefined | null, onrejected?: ((reason: any) => TResult2 | Promise<TResult2>) | undefined | null): Promise<TResult1 | TResult2>;
  /**
   * Attaches a callback for only the rejection of the Promise.
   * @param onrejected The callback to execute when the Promise is rejected.
   * @returns A Promise for the completion of the callback.
   */
  catch<TResult = never>(onrejected?: ((reason: any) => TResult | Promise<TResult>) | undefined | null): Promise<T | TResult>;
  /**
   * Attaches a callback that is invoked when the Promise is settled (fulfilled or rejected). The
   * resolved value cannot be modified from the callback.
   * @param onfinally The callback to execute when the Promise is settled (fulfilled or rejected).
   * @returns A Promise for the completion of the callback.
   */
  finally(onfinally?: (() => void) | undefined | null): Promise<T>;
}

// Custom InputTypes

/**
 * TreeNode findOne
 */
export type FindOneTreeNodeArgs = {
  /**
   * Select specific fields to fetch from the TreeNode
  **/
  select?: TreeNodeSelect | null
  /**
   * Filter, which TreeNode to fetch.
  **/
  where: TreeNodeWhereUniqueInput
}


/**
 * TreeNode findMany
 */
export type FindManyTreeNodeArgs = {
  /**
   * Select specific fields to fetch from the TreeNode
  **/
  select?: TreeNodeSelect | null
  /**
   * Filter, which TreeNodes to fetch.
  **/
  where?: TreeNodeWhereInput
  /**
   * Determine the order of the TreeNodes to fetch.
  **/
  orderBy?: Enumerable<TreeNodeOrderByInput>
  /**
   * Sets the position for listing TreeNodes.
  **/
  cursor?: TreeNodeWhereUniqueInput
  /**
   * The number of TreeNodes to fetch. If negative number, it will take TreeNodes before the `cursor`.
  **/
  take?: number
  /**
   * Skip the first `n` TreeNodes.
  **/
  skip?: number
  distinct?: Enumerable<TreeNodeDistinctFieldEnum>
}


/**
 * TreeNode create
 */
export type TreeNodeCreateArgs = {
  /**
   * Select specific fields to fetch from the TreeNode
  **/
  select?: TreeNodeSelect | null
  /**
   * The data needed to create a TreeNode.
  **/
  data: TreeNodeCreateInput
}


/**
 * TreeNode update
 */
export type TreeNodeUpdateArgs = {
  /**
   * Select specific fields to fetch from the TreeNode
  **/
  select?: TreeNodeSelect | null
  /**
   * The data needed to update a TreeNode.
  **/
  data: TreeNodeUpdateInput
  /**
   * Choose, which TreeNode to update.
  **/
  where: TreeNodeWhereUniqueInput
}


/**
 * TreeNode updateMany
 */
export type TreeNodeUpdateManyArgs = {
  data: TreeNodeUpdateManyMutationInput
  where?: TreeNodeWhereInput
}


/**
 * TreeNode upsert
 */
export type TreeNodeUpsertArgs = {
  /**
   * Select specific fields to fetch from the TreeNode
  **/
  select?: TreeNodeSelect | null
  /**
   * The filter to search for the TreeNode to update in case it exists.
  **/
  where: TreeNodeWhereUniqueInput
  /**
   * In case the TreeNode found by the `where` argument doesn't exist, create a new TreeNode with this data.
  **/
  create: TreeNodeCreateInput
  /**
   * In case the TreeNode was found with the provided `where` argument, update it with this data.
  **/
  update: TreeNodeUpdateInput
}


/**
 * TreeNode delete
 */
export type TreeNodeDeleteArgs = {
  /**
   * Select specific fields to fetch from the TreeNode
  **/
  select?: TreeNodeSelect | null
  /**
   * Filter which TreeNode to delete.
  **/
  where: TreeNodeWhereUniqueInput
}


/**
 * TreeNode deleteMany
 */
export type TreeNodeDeleteManyArgs = {
  where?: TreeNodeWhereInput
}


/**
 * TreeNode without action
 */
export type TreeNodeArgs = {
  /**
   * Select specific fields to fetch from the TreeNode
  **/
  select?: TreeNodeSelect | null
}



/**
 * Model LightTree
 */

export type LightTree = {
  id: string
  species: number
  start: string
  end: string
  root: string
  index: string
  siblings: string
}


export type AggregateLightTree = {
  count: number
  avg: LightTreeAvgAggregateOutputType | null
  sum: LightTreeSumAggregateOutputType | null
  min: LightTreeMinAggregateOutputType | null
  max: LightTreeMaxAggregateOutputType | null
}

export type LightTreeAvgAggregateOutputType = {
  species: number
}

export type LightTreeSumAggregateOutputType = {
  species: number
}

export type LightTreeMinAggregateOutputType = {
  species: number
}

export type LightTreeMaxAggregateOutputType = {
  species: number
}


export type LightTreeAvgAggregateInputType = {
  species?: true
}

export type LightTreeSumAggregateInputType = {
  species?: true
}

export type LightTreeMinAggregateInputType = {
  species?: true
}

export type LightTreeMaxAggregateInputType = {
  species?: true
}

export type AggregateLightTreeArgs = {
  where?: LightTreeWhereInput
  orderBy?: Enumerable<LightTreeOrderByInput>
  cursor?: LightTreeWhereUniqueInput
  take?: number
  skip?: number
  distinct?: Enumerable<LightTreeDistinctFieldEnum>
  count?: true
  avg?: LightTreeAvgAggregateInputType
  sum?: LightTreeSumAggregateInputType
  min?: LightTreeMinAggregateInputType
  max?: LightTreeMaxAggregateInputType
}

export type GetLightTreeAggregateType<T extends AggregateLightTreeArgs> = {
  [P in keyof T]: P extends 'count' ? number : GetLightTreeAggregateScalarType<T[P]>
}

export type GetLightTreeAggregateScalarType<T extends any> = {
  [P in keyof T]: P extends keyof LightTreeAvgAggregateOutputType ? LightTreeAvgAggregateOutputType[P] : never
}
    
    

export type LightTreeSelect = {
  id?: boolean
  species?: boolean
  start?: boolean
  end?: boolean
  root?: boolean
  index?: boolean
  siblings?: boolean
}

export type LightTreeGetPayload<
  S extends boolean | null | undefined | LightTreeArgs,
  U = keyof S
> = S extends true
  ? LightTree
  : S extends undefined
  ? never
  : S extends LightTreeArgs | FindManyLightTreeArgs
  ? 'include' extends U
    ? LightTree 
  : 'select' extends U
    ? {
      [P in TrueKeys<S['select']>]:P extends keyof LightTree ? LightTree[P]
: 
 never
    }
  : LightTree
: LightTree


export interface LightTreeDelegate {
  /**
   * Find zero or one LightTree.
   * @param {FindOneLightTreeArgs} args - Arguments to find a LightTree
   * @example
   * // Get one LightTree
   * const lightTree = await prisma.lightTree.findOne({
   *   where: {
   *     // ... provide filter here
   *   }
   * })
  **/
  findOne<T extends FindOneLightTreeArgs>(
    args: Subset<T, FindOneLightTreeArgs>
  ): CheckSelect<T, Prisma__LightTreeClient<LightTree | null>, Prisma__LightTreeClient<LightTreeGetPayload<T> | null>>
  /**
   * Find zero or more LightTrees.
   * @param {FindManyLightTreeArgs=} args - Arguments to filter and select certain fields only.
   * @example
   * // Get all LightTrees
   * const lightTrees = await prisma.lightTree.findMany()
   * 
   * // Get first 10 LightTrees
   * const lightTrees = await prisma.lightTree.findMany({ take: 10 })
   * 
   * // Only select the `id`
   * const lightTreeWithIdOnly = await prisma.lightTree.findMany({ select: { id: true } })
   * 
  **/
  findMany<T extends FindManyLightTreeArgs>(
    args?: Subset<T, FindManyLightTreeArgs>
  ): CheckSelect<T, Promise<Array<LightTree>>, Promise<Array<LightTreeGetPayload<T>>>>
  /**
   * Create a LightTree.
   * @param {LightTreeCreateArgs} args - Arguments to create a LightTree.
   * @example
   * // Create one LightTree
   * const LightTree = await prisma.lightTree.create({
   *   data: {
   *     // ... data to create a LightTree
   *   }
   * })
   * 
  **/
  create<T extends LightTreeCreateArgs>(
    args: Subset<T, LightTreeCreateArgs>
  ): CheckSelect<T, Prisma__LightTreeClient<LightTree>, Prisma__LightTreeClient<LightTreeGetPayload<T>>>
  /**
   * Delete a LightTree.
   * @param {LightTreeDeleteArgs} args - Arguments to delete one LightTree.
   * @example
   * // Delete one LightTree
   * const LightTree = await prisma.lightTree.delete({
   *   where: {
   *     // ... filter to delete one LightTree
   *   }
   * })
   * 
  **/
  delete<T extends LightTreeDeleteArgs>(
    args: Subset<T, LightTreeDeleteArgs>
  ): CheckSelect<T, Prisma__LightTreeClient<LightTree>, Prisma__LightTreeClient<LightTreeGetPayload<T>>>
  /**
   * Update one LightTree.
   * @param {LightTreeUpdateArgs} args - Arguments to update one LightTree.
   * @example
   * // Update one LightTree
   * const lightTree = await prisma.lightTree.update({
   *   where: {
   *     // ... provide filter here
   *   },
   *   data: {
   *     // ... provide data here
   *   }
   * })
   * 
  **/
  update<T extends LightTreeUpdateArgs>(
    args: Subset<T, LightTreeUpdateArgs>
  ): CheckSelect<T, Prisma__LightTreeClient<LightTree>, Prisma__LightTreeClient<LightTreeGetPayload<T>>>
  /**
   * Delete zero or more LightTrees.
   * @param {LightTreeDeleteManyArgs} args - Arguments to filter LightTrees to delete.
   * @example
   * // Delete a few LightTrees
   * const { count } = await prisma.lightTree.deleteMany({
   *   where: {
   *     // ... provide filter here
   *   }
   * })
   * 
  **/
  deleteMany<T extends LightTreeDeleteManyArgs>(
    args: Subset<T, LightTreeDeleteManyArgs>
  ): Promise<BatchPayload>
  /**
   * Update zero or more LightTrees.
   * @param {LightTreeUpdateManyArgs} args - Arguments to update one or more rows.
   * @example
   * // Update many LightTrees
   * const lightTree = await prisma.lightTree.updateMany({
   *   where: {
   *     // ... provide filter here
   *   },
   *   data: {
   *     // ... provide data here
   *   }
   * })
   * 
  **/
  updateMany<T extends LightTreeUpdateManyArgs>(
    args: Subset<T, LightTreeUpdateManyArgs>
  ): Promise<BatchPayload>
  /**
   * Create or update one LightTree.
   * @param {LightTreeUpsertArgs} args - Arguments to update or create a LightTree.
   * @example
   * // Update or create a LightTree
   * const lightTree = await prisma.lightTree.upsert({
   *   create: {
   *     // ... data to create a LightTree
   *   },
   *   update: {
   *     // ... in case it already exists, update
   *   },
   *   where: {
   *     // ... the filter for the LightTree we want to update
   *   }
   * })
  **/
  upsert<T extends LightTreeUpsertArgs>(
    args: Subset<T, LightTreeUpsertArgs>
  ): CheckSelect<T, Prisma__LightTreeClient<LightTree>, Prisma__LightTreeClient<LightTreeGetPayload<T>>>
  /**
   * Count
   */
  count(args?: Omit<FindManyLightTreeArgs, 'select' | 'include'>): Promise<number>

  /**
   * Aggregate
   */
  aggregate<T extends AggregateLightTreeArgs>(args: Subset<T, AggregateLightTreeArgs>): Promise<GetLightTreeAggregateType<T>>
}

/**
 * The delegate class that acts as a "Promise-like" for LightTree.
 * Why is this prefixed with `Prisma__`?
 * Because we want to prevent naming conflicts as mentioned in 
 * https://github.com/prisma/prisma-client-js/issues/707
 */
export declare class Prisma__LightTreeClient<T> implements Promise<T> {
  private readonly _dmmf;
  private readonly _fetcher;
  private readonly _queryType;
  private readonly _rootField;
  private readonly _clientMethod;
  private readonly _args;
  private readonly _dataPath;
  private readonly _errorFormat;
  private readonly _measurePerformance?;
  private _isList;
  private _callsite;
  private _requestPromise?;
  constructor(_dmmf: DMMFClass, _fetcher: PrismaClientFetcher, _queryType: 'query' | 'mutation', _rootField: string, _clientMethod: string, _args: any, _dataPath: string[], _errorFormat: ErrorFormat, _measurePerformance?: boolean | undefined, _isList?: boolean);
  readonly [Symbol.toStringTag]: 'PrismaClientPromise';


  private get _document();
  /**
   * Attaches callbacks for the resolution and/or rejection of the Promise.
   * @param onfulfilled The callback to execute when the Promise is resolved.
   * @param onrejected The callback to execute when the Promise is rejected.
   * @returns A Promise for the completion of which ever callback is executed.
   */
  then<TResult1 = T, TResult2 = never>(onfulfilled?: ((value: T) => TResult1 | Promise<TResult1>) | undefined | null, onrejected?: ((reason: any) => TResult2 | Promise<TResult2>) | undefined | null): Promise<TResult1 | TResult2>;
  /**
   * Attaches a callback for only the rejection of the Promise.
   * @param onrejected The callback to execute when the Promise is rejected.
   * @returns A Promise for the completion of the callback.
   */
  catch<TResult = never>(onrejected?: ((reason: any) => TResult | Promise<TResult>) | undefined | null): Promise<T | TResult>;
  /**
   * Attaches a callback that is invoked when the Promise is settled (fulfilled or rejected). The
   * resolved value cannot be modified from the callback.
   * @param onfinally The callback to execute when the Promise is settled (fulfilled or rejected).
   * @returns A Promise for the completion of the callback.
   */
  finally(onfinally?: (() => void) | undefined | null): Promise<T>;
}

// Custom InputTypes

/**
 * LightTree findOne
 */
export type FindOneLightTreeArgs = {
  /**
   * Select specific fields to fetch from the LightTree
  **/
  select?: LightTreeSelect | null
  /**
   * Filter, which LightTree to fetch.
  **/
  where: LightTreeWhereUniqueInput
}


/**
 * LightTree findMany
 */
export type FindManyLightTreeArgs = {
  /**
   * Select specific fields to fetch from the LightTree
  **/
  select?: LightTreeSelect | null
  /**
   * Filter, which LightTrees to fetch.
  **/
  where?: LightTreeWhereInput
  /**
   * Determine the order of the LightTrees to fetch.
  **/
  orderBy?: Enumerable<LightTreeOrderByInput>
  /**
   * Sets the position for listing LightTrees.
  **/
  cursor?: LightTreeWhereUniqueInput
  /**
   * The number of LightTrees to fetch. If negative number, it will take LightTrees before the `cursor`.
  **/
  take?: number
  /**
   * Skip the first `n` LightTrees.
  **/
  skip?: number
  distinct?: Enumerable<LightTreeDistinctFieldEnum>
}


/**
 * LightTree create
 */
export type LightTreeCreateArgs = {
  /**
   * Select specific fields to fetch from the LightTree
  **/
  select?: LightTreeSelect | null
  /**
   * The data needed to create a LightTree.
  **/
  data: LightTreeCreateInput
}


/**
 * LightTree update
 */
export type LightTreeUpdateArgs = {
  /**
   * Select specific fields to fetch from the LightTree
  **/
  select?: LightTreeSelect | null
  /**
   * The data needed to update a LightTree.
  **/
  data: LightTreeUpdateInput
  /**
   * Choose, which LightTree to update.
  **/
  where: LightTreeWhereUniqueInput
}


/**
 * LightTree updateMany
 */
export type LightTreeUpdateManyArgs = {
  data: LightTreeUpdateManyMutationInput
  where?: LightTreeWhereInput
}


/**
 * LightTree upsert
 */
export type LightTreeUpsertArgs = {
  /**
   * Select specific fields to fetch from the LightTree
  **/
  select?: LightTreeSelect | null
  /**
   * The filter to search for the LightTree to update in case it exists.
  **/
  where: LightTreeWhereUniqueInput
  /**
   * In case the LightTree found by the `where` argument doesn't exist, create a new LightTree with this data.
  **/
  create: LightTreeCreateInput
  /**
   * In case the LightTree was found with the provided `where` argument, update it with this data.
  **/
  update: LightTreeUpdateInput
}


/**
 * LightTree delete
 */
export type LightTreeDeleteArgs = {
  /**
   * Select specific fields to fetch from the LightTree
  **/
  select?: LightTreeSelect | null
  /**
   * Filter which LightTree to delete.
  **/
  where: LightTreeWhereUniqueInput
}


/**
 * LightTree deleteMany
 */
export type LightTreeDeleteManyArgs = {
  where?: LightTreeWhereInput
}


/**
 * LightTree without action
 */
export type LightTreeArgs = {
  /**
   * Select specific fields to fetch from the LightTree
  **/
  select?: LightTreeSelect | null
}



/**
 * Model TokenRegistry
 */

export type TokenRegistry = {
  address: string
  isERC20: boolean
  isERC721: boolean
  identifier: number
  blockNumber: number
}


export type AggregateTokenRegistry = {
  count: number
  avg: TokenRegistryAvgAggregateOutputType | null
  sum: TokenRegistrySumAggregateOutputType | null
  min: TokenRegistryMinAggregateOutputType | null
  max: TokenRegistryMaxAggregateOutputType | null
}

export type TokenRegistryAvgAggregateOutputType = {
  identifier: number
  blockNumber: number
}

export type TokenRegistrySumAggregateOutputType = {
  identifier: number
  blockNumber: number
}

export type TokenRegistryMinAggregateOutputType = {
  identifier: number
  blockNumber: number
}

export type TokenRegistryMaxAggregateOutputType = {
  identifier: number
  blockNumber: number
}


export type TokenRegistryAvgAggregateInputType = {
  identifier?: true
  blockNumber?: true
}

export type TokenRegistrySumAggregateInputType = {
  identifier?: true
  blockNumber?: true
}

export type TokenRegistryMinAggregateInputType = {
  identifier?: true
  blockNumber?: true
}

export type TokenRegistryMaxAggregateInputType = {
  identifier?: true
  blockNumber?: true
}

export type AggregateTokenRegistryArgs = {
  where?: TokenRegistryWhereInput
  orderBy?: Enumerable<TokenRegistryOrderByInput>
  cursor?: TokenRegistryWhereUniqueInput
  take?: number
  skip?: number
  distinct?: Enumerable<TokenRegistryDistinctFieldEnum>
  count?: true
  avg?: TokenRegistryAvgAggregateInputType
  sum?: TokenRegistrySumAggregateInputType
  min?: TokenRegistryMinAggregateInputType
  max?: TokenRegistryMaxAggregateInputType
}

export type GetTokenRegistryAggregateType<T extends AggregateTokenRegistryArgs> = {
  [P in keyof T]: P extends 'count' ? number : GetTokenRegistryAggregateScalarType<T[P]>
}

export type GetTokenRegistryAggregateScalarType<T extends any> = {
  [P in keyof T]: P extends keyof TokenRegistryAvgAggregateOutputType ? TokenRegistryAvgAggregateOutputType[P] : never
}
    
    

export type TokenRegistrySelect = {
  address?: boolean
  isERC20?: boolean
  isERC721?: boolean
  identifier?: boolean
  blockNumber?: boolean
}

export type TokenRegistryGetPayload<
  S extends boolean | null | undefined | TokenRegistryArgs,
  U = keyof S
> = S extends true
  ? TokenRegistry
  : S extends undefined
  ? never
  : S extends TokenRegistryArgs | FindManyTokenRegistryArgs
  ? 'include' extends U
    ? TokenRegistry 
  : 'select' extends U
    ? {
      [P in TrueKeys<S['select']>]:P extends keyof TokenRegistry ? TokenRegistry[P]
: 
 never
    }
  : TokenRegistry
: TokenRegistry


export interface TokenRegistryDelegate {
  /**
   * Find zero or one TokenRegistry.
   * @param {FindOneTokenRegistryArgs} args - Arguments to find a TokenRegistry
   * @example
   * // Get one TokenRegistry
   * const tokenRegistry = await prisma.tokenRegistry.findOne({
   *   where: {
   *     // ... provide filter here
   *   }
   * })
  **/
  findOne<T extends FindOneTokenRegistryArgs>(
    args: Subset<T, FindOneTokenRegistryArgs>
  ): CheckSelect<T, Prisma__TokenRegistryClient<TokenRegistry | null>, Prisma__TokenRegistryClient<TokenRegistryGetPayload<T> | null>>
  /**
   * Find zero or more TokenRegistries.
   * @param {FindManyTokenRegistryArgs=} args - Arguments to filter and select certain fields only.
   * @example
   * // Get all TokenRegistries
   * const tokenRegistries = await prisma.tokenRegistry.findMany()
   * 
   * // Get first 10 TokenRegistries
   * const tokenRegistries = await prisma.tokenRegistry.findMany({ take: 10 })
   * 
   * // Only select the `address`
   * const tokenRegistryWithAddressOnly = await prisma.tokenRegistry.findMany({ select: { address: true } })
   * 
  **/
  findMany<T extends FindManyTokenRegistryArgs>(
    args?: Subset<T, FindManyTokenRegistryArgs>
  ): CheckSelect<T, Promise<Array<TokenRegistry>>, Promise<Array<TokenRegistryGetPayload<T>>>>
  /**
   * Create a TokenRegistry.
   * @param {TokenRegistryCreateArgs} args - Arguments to create a TokenRegistry.
   * @example
   * // Create one TokenRegistry
   * const TokenRegistry = await prisma.tokenRegistry.create({
   *   data: {
   *     // ... data to create a TokenRegistry
   *   }
   * })
   * 
  **/
  create<T extends TokenRegistryCreateArgs>(
    args: Subset<T, TokenRegistryCreateArgs>
  ): CheckSelect<T, Prisma__TokenRegistryClient<TokenRegistry>, Prisma__TokenRegistryClient<TokenRegistryGetPayload<T>>>
  /**
   * Delete a TokenRegistry.
   * @param {TokenRegistryDeleteArgs} args - Arguments to delete one TokenRegistry.
   * @example
   * // Delete one TokenRegistry
   * const TokenRegistry = await prisma.tokenRegistry.delete({
   *   where: {
   *     // ... filter to delete one TokenRegistry
   *   }
   * })
   * 
  **/
  delete<T extends TokenRegistryDeleteArgs>(
    args: Subset<T, TokenRegistryDeleteArgs>
  ): CheckSelect<T, Prisma__TokenRegistryClient<TokenRegistry>, Prisma__TokenRegistryClient<TokenRegistryGetPayload<T>>>
  /**
   * Update one TokenRegistry.
   * @param {TokenRegistryUpdateArgs} args - Arguments to update one TokenRegistry.
   * @example
   * // Update one TokenRegistry
   * const tokenRegistry = await prisma.tokenRegistry.update({
   *   where: {
   *     // ... provide filter here
   *   },
   *   data: {
   *     // ... provide data here
   *   }
   * })
   * 
  **/
  update<T extends TokenRegistryUpdateArgs>(
    args: Subset<T, TokenRegistryUpdateArgs>
  ): CheckSelect<T, Prisma__TokenRegistryClient<TokenRegistry>, Prisma__TokenRegistryClient<TokenRegistryGetPayload<T>>>
  /**
   * Delete zero or more TokenRegistries.
   * @param {TokenRegistryDeleteManyArgs} args - Arguments to filter TokenRegistries to delete.
   * @example
   * // Delete a few TokenRegistries
   * const { count } = await prisma.tokenRegistry.deleteMany({
   *   where: {
   *     // ... provide filter here
   *   }
   * })
   * 
  **/
  deleteMany<T extends TokenRegistryDeleteManyArgs>(
    args: Subset<T, TokenRegistryDeleteManyArgs>
  ): Promise<BatchPayload>
  /**
   * Update zero or more TokenRegistries.
   * @param {TokenRegistryUpdateManyArgs} args - Arguments to update one or more rows.
   * @example
   * // Update many TokenRegistries
   * const tokenRegistry = await prisma.tokenRegistry.updateMany({
   *   where: {
   *     // ... provide filter here
   *   },
   *   data: {
   *     // ... provide data here
   *   }
   * })
   * 
  **/
  updateMany<T extends TokenRegistryUpdateManyArgs>(
    args: Subset<T, TokenRegistryUpdateManyArgs>
  ): Promise<BatchPayload>
  /**
   * Create or update one TokenRegistry.
   * @param {TokenRegistryUpsertArgs} args - Arguments to update or create a TokenRegistry.
   * @example
   * // Update or create a TokenRegistry
   * const tokenRegistry = await prisma.tokenRegistry.upsert({
   *   create: {
   *     // ... data to create a TokenRegistry
   *   },
   *   update: {
   *     // ... in case it already exists, update
   *   },
   *   where: {
   *     // ... the filter for the TokenRegistry we want to update
   *   }
   * })
  **/
  upsert<T extends TokenRegistryUpsertArgs>(
    args: Subset<T, TokenRegistryUpsertArgs>
  ): CheckSelect<T, Prisma__TokenRegistryClient<TokenRegistry>, Prisma__TokenRegistryClient<TokenRegistryGetPayload<T>>>
  /**
   * Count
   */
  count(args?: Omit<FindManyTokenRegistryArgs, 'select' | 'include'>): Promise<number>

  /**
   * Aggregate
   */
  aggregate<T extends AggregateTokenRegistryArgs>(args: Subset<T, AggregateTokenRegistryArgs>): Promise<GetTokenRegistryAggregateType<T>>
}

/**
 * The delegate class that acts as a "Promise-like" for TokenRegistry.
 * Why is this prefixed with `Prisma__`?
 * Because we want to prevent naming conflicts as mentioned in 
 * https://github.com/prisma/prisma-client-js/issues/707
 */
export declare class Prisma__TokenRegistryClient<T> implements Promise<T> {
  private readonly _dmmf;
  private readonly _fetcher;
  private readonly _queryType;
  private readonly _rootField;
  private readonly _clientMethod;
  private readonly _args;
  private readonly _dataPath;
  private readonly _errorFormat;
  private readonly _measurePerformance?;
  private _isList;
  private _callsite;
  private _requestPromise?;
  constructor(_dmmf: DMMFClass, _fetcher: PrismaClientFetcher, _queryType: 'query' | 'mutation', _rootField: string, _clientMethod: string, _args: any, _dataPath: string[], _errorFormat: ErrorFormat, _measurePerformance?: boolean | undefined, _isList?: boolean);
  readonly [Symbol.toStringTag]: 'PrismaClientPromise';


  private get _document();
  /**
   * Attaches callbacks for the resolution and/or rejection of the Promise.
   * @param onfulfilled The callback to execute when the Promise is resolved.
   * @param onrejected The callback to execute when the Promise is rejected.
   * @returns A Promise for the completion of which ever callback is executed.
   */
  then<TResult1 = T, TResult2 = never>(onfulfilled?: ((value: T) => TResult1 | Promise<TResult1>) | undefined | null, onrejected?: ((reason: any) => TResult2 | Promise<TResult2>) | undefined | null): Promise<TResult1 | TResult2>;
  /**
   * Attaches a callback for only the rejection of the Promise.
   * @param onrejected The callback to execute when the Promise is rejected.
   * @returns A Promise for the completion of the callback.
   */
  catch<TResult = never>(onrejected?: ((reason: any) => TResult | Promise<TResult>) | undefined | null): Promise<T | TResult>;
  /**
   * Attaches a callback that is invoked when the Promise is settled (fulfilled or rejected). The
   * resolved value cannot be modified from the callback.
   * @param onfinally The callback to execute when the Promise is settled (fulfilled or rejected).
   * @returns A Promise for the completion of the callback.
   */
  finally(onfinally?: (() => void) | undefined | null): Promise<T>;
}

// Custom InputTypes

/**
 * TokenRegistry findOne
 */
export type FindOneTokenRegistryArgs = {
  /**
   * Select specific fields to fetch from the TokenRegistry
  **/
  select?: TokenRegistrySelect | null
  /**
   * Filter, which TokenRegistry to fetch.
  **/
  where: TokenRegistryWhereUniqueInput
}


/**
 * TokenRegistry findMany
 */
export type FindManyTokenRegistryArgs = {
  /**
   * Select specific fields to fetch from the TokenRegistry
  **/
  select?: TokenRegistrySelect | null
  /**
   * Filter, which TokenRegistries to fetch.
  **/
  where?: TokenRegistryWhereInput
  /**
   * Determine the order of the TokenRegistries to fetch.
  **/
  orderBy?: Enumerable<TokenRegistryOrderByInput>
  /**
   * Sets the position for listing TokenRegistries.
  **/
  cursor?: TokenRegistryWhereUniqueInput
  /**
   * The number of TokenRegistries to fetch. If negative number, it will take TokenRegistries before the `cursor`.
  **/
  take?: number
  /**
   * Skip the first `n` TokenRegistries.
  **/
  skip?: number
  distinct?: Enumerable<TokenRegistryDistinctFieldEnum>
}


/**
 * TokenRegistry create
 */
export type TokenRegistryCreateArgs = {
  /**
   * Select specific fields to fetch from the TokenRegistry
  **/
  select?: TokenRegistrySelect | null
  /**
   * The data needed to create a TokenRegistry.
  **/
  data: TokenRegistryCreateInput
}


/**
 * TokenRegistry update
 */
export type TokenRegistryUpdateArgs = {
  /**
   * Select specific fields to fetch from the TokenRegistry
  **/
  select?: TokenRegistrySelect | null
  /**
   * The data needed to update a TokenRegistry.
  **/
  data: TokenRegistryUpdateInput
  /**
   * Choose, which TokenRegistry to update.
  **/
  where: TokenRegistryWhereUniqueInput
}


/**
 * TokenRegistry updateMany
 */
export type TokenRegistryUpdateManyArgs = {
  data: TokenRegistryUpdateManyMutationInput
  where?: TokenRegistryWhereInput
}


/**
 * TokenRegistry upsert
 */
export type TokenRegistryUpsertArgs = {
  /**
   * Select specific fields to fetch from the TokenRegistry
  **/
  select?: TokenRegistrySelect | null
  /**
   * The filter to search for the TokenRegistry to update in case it exists.
  **/
  where: TokenRegistryWhereUniqueInput
  /**
   * In case the TokenRegistry found by the `where` argument doesn't exist, create a new TokenRegistry with this data.
  **/
  create: TokenRegistryCreateInput
  /**
   * In case the TokenRegistry was found with the provided `where` argument, update it with this data.
  **/
  update: TokenRegistryUpdateInput
}


/**
 * TokenRegistry delete
 */
export type TokenRegistryDeleteArgs = {
  /**
   * Select specific fields to fetch from the TokenRegistry
  **/
  select?: TokenRegistrySelect | null
  /**
   * Filter which TokenRegistry to delete.
  **/
  where: TokenRegistryWhereUniqueInput
}


/**
 * TokenRegistry deleteMany
 */
export type TokenRegistryDeleteManyArgs = {
  where?: TokenRegistryWhereInput
}


/**
 * TokenRegistry without action
 */
export type TokenRegistryArgs = {
  /**
   * Select specific fields to fetch from the TokenRegistry
  **/
  select?: TokenRegistrySelect | null
}



/**
 * Deep Input Types
 */


export type EncryptedWalletWhereInput = {
  AND?: Enumerable<EncryptedWalletWhereInput>
  OR?: Array<EncryptedWalletWhereInput>
  NOT?: Enumerable<EncryptedWalletWhereInput>
  id?: string | StringFilter
  ciphertext?: string | StringFilter
  iv?: string | StringFilter
  algorithm?: string | StringFilter
  keylen?: number | IntFilter
  kdf?: string | StringFilter
  N?: number | IntFilter
  r?: number | IntFilter
  p?: number | IntFilter
  salt?: string | StringFilter
}

export type EncryptedWalletOrderByInput = {
  id?: SortOrder
  ciphertext?: SortOrder
  iv?: SortOrder
  algorithm?: SortOrder
  keylen?: SortOrder
  kdf?: SortOrder
  N?: SortOrder
  r?: SortOrder
  p?: SortOrder
  salt?: SortOrder
}

export type EncryptedWalletWhereUniqueInput = {
  id?: string
}

export type KeystoreWhereInput = {
  AND?: Enumerable<KeystoreWhereInput>
  OR?: Array<KeystoreWhereInput>
  NOT?: Enumerable<KeystoreWhereInput>
  address?: string | StringFilter
  zkAddress?: string | StringFilter
  encrypted?: string | StringFilter
}

export type KeystoreOrderByInput = {
  address?: SortOrder
  zkAddress?: SortOrder
  encrypted?: SortOrder
}

export type KeystoreWhereUniqueInput = {
  address?: string
}

export type ConfigWhereInput = {
  AND?: Enumerable<ConfigWhereInput>
  OR?: Array<ConfigWhereInput>
  NOT?: Enumerable<ConfigWhereInput>
  id?: string | StringFilter
  networkId?: number | IntFilter
  chainId?: number | IntFilter
  address?: string | StringFilter
  utxoTreeDepth?: number | IntFilter
  withdrawalTreeDepth?: number | IntFilter
  nullifierTreeDepth?: number | IntFilter
  challengePeriod?: number | IntFilter
  minimumStake?: string | StringFilter
  referenceDepth?: number | IntFilter
  maxUtxo?: string | StringFilter
  maxWithdrawal?: string | StringFilter
  utxoSubTreeDepth?: number | IntFilter
  utxoSubTreeSize?: number | IntFilter
  withdrawalSubTreeDepth?: number | IntFilter
  withdrawalSubTreeSize?: number | IntFilter
}

export type ConfigOrderByInput = {
  id?: SortOrder
  networkId?: SortOrder
  chainId?: SortOrder
  address?: SortOrder
  utxoTreeDepth?: SortOrder
  withdrawalTreeDepth?: SortOrder
  nullifierTreeDepth?: SortOrder
  challengePeriod?: SortOrder
  minimumStake?: SortOrder
  referenceDepth?: SortOrder
  maxUtxo?: SortOrder
  maxWithdrawal?: SortOrder
  utxoSubTreeDepth?: SortOrder
  utxoSubTreeSize?: SortOrder
  withdrawalSubTreeDepth?: SortOrder
  withdrawalSubTreeSize?: SortOrder
}

export type ConfigWhereUniqueInput = {
  id?: string
  networkId_chainId_address?: NetworkIdChainIdAddressCompoundUniqueInput
}

export type TrackerWhereInput = {
  AND?: Enumerable<TrackerWhereInput>
  OR?: Array<TrackerWhereInput>
  NOT?: Enumerable<TrackerWhereInput>
  id?: number | IntFilter
  viewer?: string | StringNullableFilter | null
  address?: string | StringNullableFilter | null
}

export type TrackerOrderByInput = {
  id?: SortOrder
  viewer?: SortOrder
  address?: SortOrder
}

export type TrackerWhereUniqueInput = {
  id?: number
  viewer?: string | null
  address?: string | null
}

export type ProposalWhereInput = {
  AND?: Enumerable<ProposalWhereInput>
  OR?: Array<ProposalWhereInput>
  NOT?: Enumerable<ProposalWhereInput>
  hash?: string | StringFilter
  proposalNum?: number | IntNullableFilter | null
  proposedAt?: number | IntNullableFilter | null
  proposalTx?: string | StringNullableFilter | null
  proposalData?: string | StringNullableFilter | null
  fetched?: string | StringNullableFilter | null
  finalized?: boolean | BoolNullableFilter | null
  verified?: boolean | BoolNullableFilter | null
  isUncle?: boolean | BoolNullableFilter | null
  block?: BlockWhereInput | null
}

export type ProposalOrderByInput = {
  hash?: SortOrder
  proposalNum?: SortOrder
  proposedAt?: SortOrder
  proposalTx?: SortOrder
  proposalData?: SortOrder
  fetched?: SortOrder
  finalized?: SortOrder
  verified?: SortOrder
  isUncle?: SortOrder
}

export type ProposalWhereUniqueInput = {
  hash?: string
}

export type BlockWhereInput = {
  AND?: Enumerable<BlockWhereInput>
  OR?: Array<BlockWhereInput>
  NOT?: Enumerable<BlockWhereInput>
  hash?: string | StringFilter
  header?: HeaderWhereInput | null
  proposal?: ProposalWhereInput | null
  bootstrap?: BootstrapWhereInput | null
  slash?: SlashWhereInput | null
}

export type BlockOrderByInput = {
  hash?: SortOrder
}

export type BlockWhereUniqueInput = {
  hash?: string
}

export type SlashWhereInput = {
  AND?: Enumerable<SlashWhereInput>
  OR?: Array<SlashWhereInput>
  NOT?: Enumerable<SlashWhereInput>
  hash?: string | StringFilter
  proposer?: string | StringFilter
  reason?: string | StringFilter
  executionTx?: string | StringFilter
  slashedAt?: number | IntFilter
  block?: BlockWhereInput | null
}

export type SlashOrderByInput = {
  hash?: SortOrder
  proposer?: SortOrder
  reason?: SortOrder
  executionTx?: SortOrder
  slashedAt?: SortOrder
}

export type SlashWhereUniqueInput = {
  hash?: string
}

export type HeaderWhereInput = {
  AND?: Enumerable<HeaderWhereInput>
  OR?: Array<HeaderWhereInput>
  NOT?: Enumerable<HeaderWhereInput>
  hash?: string | StringFilter
  proposer?: string | StringFilter
  parentBlock?: string | StringFilter
  fee?: string | StringFilter
  utxoRoot?: string | StringFilter
  utxoIndex?: string | StringFilter
  nullifierRoot?: string | StringFilter
  withdrawalRoot?: string | StringFilter
  withdrawalIndex?: string | StringFilter
  txRoot?: string | StringFilter
  depositRoot?: string | StringFilter
  migrationRoot?: string | StringFilter
  Block?: BlockListRelationFilter
}

export type HeaderOrderByInput = {
  hash?: SortOrder
  proposer?: SortOrder
  parentBlock?: SortOrder
  fee?: SortOrder
  utxoRoot?: SortOrder
  utxoIndex?: SortOrder
  nullifierRoot?: SortOrder
  withdrawalRoot?: SortOrder
  withdrawalIndex?: SortOrder
  txRoot?: SortOrder
  depositRoot?: SortOrder
  migrationRoot?: SortOrder
}

export type HeaderWhereUniqueInput = {
  hash?: string
}

export type BootstrapWhereInput = {
  AND?: Enumerable<BootstrapWhereInput>
  OR?: Array<BootstrapWhereInput>
  NOT?: Enumerable<BootstrapWhereInput>
  id?: string | StringFilter
  blockHash?: string | StringNullableFilter | null
  utxoBootstrap?: string | StringFilter
  withdrawalBootstrap?: string | StringFilter
  block?: BlockWhereInput | null
}

export type BootstrapOrderByInput = {
  id?: SortOrder
  blockHash?: SortOrder
  utxoBootstrap?: SortOrder
  withdrawalBootstrap?: SortOrder
}

export type BootstrapWhereUniqueInput = {
  id?: string
  blockHash?: string | null
}

export type MassDepositWhereInput = {
  AND?: Enumerable<MassDepositWhereInput>
  OR?: Array<MassDepositWhereInput>
  NOT?: Enumerable<MassDepositWhereInput>
  index?: string | StringFilter
  merged?: string | StringFilter
  fee?: string | StringFilter
  blockNumber?: number | IntFilter
  includedIn?: string | StringNullableFilter | null
}

export type MassDepositOrderByInput = {
  index?: SortOrder
  merged?: SortOrder
  fee?: SortOrder
  blockNumber?: SortOrder
  includedIn?: SortOrder
}

export type MassDepositWhereUniqueInput = {
  index?: string
}

export type DepositWhereInput = {
  AND?: Enumerable<DepositWhereInput>
  OR?: Array<DepositWhereInput>
  NOT?: Enumerable<DepositWhereInput>
  note?: string | StringFilter
  fee?: string | StringFilter
  transactionIndex?: number | IntFilter
  logIndex?: number | IntFilter
  blockNumber?: number | IntFilter
  queuedAt?: string | StringFilter
}

export type DepositOrderByInput = {
  note?: SortOrder
  fee?: SortOrder
  transactionIndex?: SortOrder
  logIndex?: SortOrder
  blockNumber?: SortOrder
  queuedAt?: SortOrder
}

export type DepositWhereUniqueInput = {
  note?: string
}

export type UtxoWhereInput = {
  AND?: Enumerable<UtxoWhereInput>
  OR?: Array<UtxoWhereInput>
  NOT?: Enumerable<UtxoWhereInput>
  hash?: string | StringFilter
  eth?: string | StringNullableFilter | null
  owner?: string | StringNullableFilter | null
  salt?: string | StringNullableFilter | null
  tokenAddr?: string | StringNullableFilter | null
  erc20Amount?: string | StringNullableFilter | null
  nft?: string | StringNullableFilter | null
  status?: number | IntNullableFilter | null
  treeId?: string | StringNullableFilter | null
  index?: string | StringNullableFilter | null
  nullifier?: string | StringNullableFilter | null
  usedAt?: string | StringNullableFilter | null
}

export type UtxoOrderByInput = {
  hash?: SortOrder
  eth?: SortOrder
  owner?: SortOrder
  salt?: SortOrder
  tokenAddr?: SortOrder
  erc20Amount?: SortOrder
  nft?: SortOrder
  status?: SortOrder
  treeId?: SortOrder
  index?: SortOrder
  nullifier?: SortOrder
  usedAt?: SortOrder
}

export type UtxoWhereUniqueInput = {
  hash?: string
}

export type WithdrawalWhereInput = {
  AND?: Enumerable<WithdrawalWhereInput>
  OR?: Array<WithdrawalWhereInput>
  NOT?: Enumerable<WithdrawalWhereInput>
  hash?: string | StringFilter
  withdrawalHash?: string | StringFilter
  eth?: string | StringFilter
  owner?: string | StringNullableFilter | null
  salt?: string | StringNullableFilter | null
  tokenAddr?: string | StringFilter
  erc20Amount?: string | StringFilter
  nft?: string | StringFilter
  to?: string | StringFilter
  fee?: string | StringFilter
  status?: number | IntNullableFilter | null
  treeId?: string | StringNullableFilter | null
  index?: string | StringNullableFilter | null
  includedIn?: string | StringNullableFilter | null
  prepayer?: string | StringNullableFilter | null
  siblings?: string | StringNullableFilter | null
}

export type WithdrawalOrderByInput = {
  hash?: SortOrder
  withdrawalHash?: SortOrder
  eth?: SortOrder
  owner?: SortOrder
  salt?: SortOrder
  tokenAddr?: SortOrder
  erc20Amount?: SortOrder
  nft?: SortOrder
  to?: SortOrder
  fee?: SortOrder
  status?: SortOrder
  treeId?: SortOrder
  index?: SortOrder
  includedIn?: SortOrder
  prepayer?: SortOrder
  siblings?: SortOrder
}

export type WithdrawalWhereUniqueInput = {
  hash?: string
}

export type MigrationWhereInput = {
  AND?: Enumerable<MigrationWhereInput>
  OR?: Array<MigrationWhereInput>
  NOT?: Enumerable<MigrationWhereInput>
  hash?: string | StringFilter
  eth?: string | StringNullableFilter | null
  owner?: string | StringNullableFilter | null
  salt?: string | StringNullableFilter | null
  tokenAddr?: string | StringNullableFilter | null
  erc20Amount?: string | StringNullableFilter | null
  nft?: string | StringNullableFilter | null
  to?: string | StringNullableFilter | null
  fee?: string | StringNullableFilter | null
  status?: number | IntNullableFilter | null
  treeId?: string | StringNullableFilter | null
  index?: string | StringNullableFilter | null
  usedFor?: string | StringNullableFilter | null
}

export type MigrationOrderByInput = {
  hash?: SortOrder
  eth?: SortOrder
  owner?: SortOrder
  salt?: SortOrder
  tokenAddr?: SortOrder
  erc20Amount?: SortOrder
  nft?: SortOrder
  to?: SortOrder
  fee?: SortOrder
  status?: SortOrder
  treeId?: SortOrder
  index?: SortOrder
  usedFor?: SortOrder
}

export type MigrationWhereUniqueInput = {
  hash?: string
}

export type TreeNodeWhereInput = {
  AND?: Enumerable<TreeNodeWhereInput>
  OR?: Array<TreeNodeWhereInput>
  NOT?: Enumerable<TreeNodeWhereInput>
  treeId?: string | StringFilter
  nodeIndex?: string | StringFilter
  value?: string | StringFilter
}

export type TreeNodeOrderByInput = {
  treeId?: SortOrder
  nodeIndex?: SortOrder
  value?: SortOrder
}

export type TreeNodeWhereUniqueInput = {
  treeId_nodeIndex?: TreeIdNodeIndexCompoundUniqueInput
}

export type LightTreeWhereInput = {
  AND?: Enumerable<LightTreeWhereInput>
  OR?: Array<LightTreeWhereInput>
  NOT?: Enumerable<LightTreeWhereInput>
  id?: string | StringFilter
  species?: number | IntFilter
  start?: string | StringFilter
  end?: string | StringFilter
  root?: string | StringFilter
  index?: string | StringFilter
  siblings?: string | StringFilter
}

export type LightTreeOrderByInput = {
  id?: SortOrder
  species?: SortOrder
  start?: SortOrder
  end?: SortOrder
  root?: SortOrder
  index?: SortOrder
  siblings?: SortOrder
}

export type LightTreeWhereUniqueInput = {
  id?: string
  species?: number
}

export type TokenRegistryWhereInput = {
  AND?: Enumerable<TokenRegistryWhereInput>
  OR?: Array<TokenRegistryWhereInput>
  NOT?: Enumerable<TokenRegistryWhereInput>
  address?: string | StringFilter
  isERC20?: boolean | BoolFilter
  isERC721?: boolean | BoolFilter
  identifier?: number | IntFilter
  blockNumber?: number | IntFilter
}

export type TokenRegistryOrderByInput = {
  address?: SortOrder
  isERC20?: SortOrder
  isERC721?: SortOrder
  identifier?: SortOrder
  blockNumber?: SortOrder
}

export type TokenRegistryWhereUniqueInput = {
  address?: string
}

export type EncryptedWalletCreateInput = {
  id?: string
  ciphertext: string
  iv: string
  algorithm: string
  keylen: number
  kdf: string
  N: number
  r: number
  p: number
  salt: string
}

export type EncryptedWalletUpdateInput = {
  id?: string | StringFieldUpdateOperationsInput
  ciphertext?: string | StringFieldUpdateOperationsInput
  iv?: string | StringFieldUpdateOperationsInput
  algorithm?: string | StringFieldUpdateOperationsInput
  keylen?: number | IntFieldUpdateOperationsInput
  kdf?: string | StringFieldUpdateOperationsInput
  N?: number | IntFieldUpdateOperationsInput
  r?: number | IntFieldUpdateOperationsInput
  p?: number | IntFieldUpdateOperationsInput
  salt?: string | StringFieldUpdateOperationsInput
}

export type EncryptedWalletUpdateManyMutationInput = {
  id?: string | StringFieldUpdateOperationsInput
  ciphertext?: string | StringFieldUpdateOperationsInput
  iv?: string | StringFieldUpdateOperationsInput
  algorithm?: string | StringFieldUpdateOperationsInput
  keylen?: number | IntFieldUpdateOperationsInput
  kdf?: string | StringFieldUpdateOperationsInput
  N?: number | IntFieldUpdateOperationsInput
  r?: number | IntFieldUpdateOperationsInput
  p?: number | IntFieldUpdateOperationsInput
  salt?: string | StringFieldUpdateOperationsInput
}

export type KeystoreCreateInput = {
  address: string
  zkAddress: string
  encrypted: string
}

export type KeystoreUpdateInput = {
  address?: string | StringFieldUpdateOperationsInput
  zkAddress?: string | StringFieldUpdateOperationsInput
  encrypted?: string | StringFieldUpdateOperationsInput
}

export type KeystoreUpdateManyMutationInput = {
  address?: string | StringFieldUpdateOperationsInput
  zkAddress?: string | StringFieldUpdateOperationsInput
  encrypted?: string | StringFieldUpdateOperationsInput
}

export type ConfigCreateInput = {
  id: string
  networkId: number
  chainId: number
  address: string
  utxoTreeDepth: number
  withdrawalTreeDepth: number
  nullifierTreeDepth: number
  challengePeriod: number
  minimumStake: string
  referenceDepth: number
  maxUtxo: string
  maxWithdrawal: string
  utxoSubTreeDepth: number
  utxoSubTreeSize: number
  withdrawalSubTreeDepth: number
  withdrawalSubTreeSize: number
}

export type ConfigUpdateInput = {
  id?: string | StringFieldUpdateOperationsInput
  networkId?: number | IntFieldUpdateOperationsInput
  chainId?: number | IntFieldUpdateOperationsInput
  address?: string | StringFieldUpdateOperationsInput
  utxoTreeDepth?: number | IntFieldUpdateOperationsInput
  withdrawalTreeDepth?: number | IntFieldUpdateOperationsInput
  nullifierTreeDepth?: number | IntFieldUpdateOperationsInput
  challengePeriod?: number | IntFieldUpdateOperationsInput
  minimumStake?: string | StringFieldUpdateOperationsInput
  referenceDepth?: number | IntFieldUpdateOperationsInput
  maxUtxo?: string | StringFieldUpdateOperationsInput
  maxWithdrawal?: string | StringFieldUpdateOperationsInput
  utxoSubTreeDepth?: number | IntFieldUpdateOperationsInput
  utxoSubTreeSize?: number | IntFieldUpdateOperationsInput
  withdrawalSubTreeDepth?: number | IntFieldUpdateOperationsInput
  withdrawalSubTreeSize?: number | IntFieldUpdateOperationsInput
}

export type ConfigUpdateManyMutationInput = {
  id?: string | StringFieldUpdateOperationsInput
  networkId?: number | IntFieldUpdateOperationsInput
  chainId?: number | IntFieldUpdateOperationsInput
  address?: string | StringFieldUpdateOperationsInput
  utxoTreeDepth?: number | IntFieldUpdateOperationsInput
  withdrawalTreeDepth?: number | IntFieldUpdateOperationsInput
  nullifierTreeDepth?: number | IntFieldUpdateOperationsInput
  challengePeriod?: number | IntFieldUpdateOperationsInput
  minimumStake?: string | StringFieldUpdateOperationsInput
  referenceDepth?: number | IntFieldUpdateOperationsInput
  maxUtxo?: string | StringFieldUpdateOperationsInput
  maxWithdrawal?: string | StringFieldUpdateOperationsInput
  utxoSubTreeDepth?: number | IntFieldUpdateOperationsInput
  utxoSubTreeSize?: number | IntFieldUpdateOperationsInput
  withdrawalSubTreeDepth?: number | IntFieldUpdateOperationsInput
  withdrawalSubTreeSize?: number | IntFieldUpdateOperationsInput
}

export type TrackerCreateInput = {
  viewer?: string | null
  address?: string | null
}

export type TrackerUpdateInput = {
  viewer?: string | NullableStringFieldUpdateOperationsInput | null
  address?: string | NullableStringFieldUpdateOperationsInput | null
}

export type TrackerUpdateManyMutationInput = {
  viewer?: string | NullableStringFieldUpdateOperationsInput | null
  address?: string | NullableStringFieldUpdateOperationsInput | null
}

export type ProposalCreateInput = {
  hash: string
  proposalNum?: number | null
  proposedAt?: number | null
  proposalTx?: string | null
  proposalData?: string | null
  finalized?: boolean | null
  verified?: boolean | null
  isUncle?: boolean | null
  block?: BlockCreateOneWithoutProposalInput
}

export type ProposalUpdateInput = {
  hash?: string | StringFieldUpdateOperationsInput
  proposalNum?: number | NullableIntFieldUpdateOperationsInput | null
  proposedAt?: number | NullableIntFieldUpdateOperationsInput | null
  proposalTx?: string | NullableStringFieldUpdateOperationsInput | null
  proposalData?: string | NullableStringFieldUpdateOperationsInput | null
  finalized?: boolean | NullableBoolFieldUpdateOperationsInput | null
  verified?: boolean | NullableBoolFieldUpdateOperationsInput | null
  isUncle?: boolean | NullableBoolFieldUpdateOperationsInput | null
  block?: BlockUpdateOneWithoutProposalInput
}

export type ProposalUpdateManyMutationInput = {
  hash?: string | StringFieldUpdateOperationsInput
  proposalNum?: number | NullableIntFieldUpdateOperationsInput | null
  proposedAt?: number | NullableIntFieldUpdateOperationsInput | null
  proposalTx?: string | NullableStringFieldUpdateOperationsInput | null
  proposalData?: string | NullableStringFieldUpdateOperationsInput | null
  finalized?: boolean | NullableBoolFieldUpdateOperationsInput | null
  verified?: boolean | NullableBoolFieldUpdateOperationsInput | null
  isUncle?: boolean | NullableBoolFieldUpdateOperationsInput | null
}

export type BlockCreateInput = {
  header: HeaderCreateOneWithoutBlockInput
  proposal: ProposalCreateOneWithoutBlockInput
  bootstrap?: BootstrapCreateOneWithoutBlockInput
  slash?: SlashCreateOneWithoutBlockInput
}

export type BlockUpdateInput = {
  header?: HeaderUpdateOneRequiredWithoutBlockInput
  proposal?: ProposalUpdateOneRequiredWithoutBlockInput
  bootstrap?: BootstrapUpdateOneWithoutBlockInput
  slash?: SlashUpdateOneWithoutBlockInput
}

export type BlockUpdateManyMutationInput = {

}

export type SlashCreateInput = {
  proposer: string
  reason: string
  executionTx: string
  slashedAt: number
  block: BlockCreateOneWithoutSlashInput
}

export type SlashUpdateInput = {
  proposer?: string | StringFieldUpdateOperationsInput
  reason?: string | StringFieldUpdateOperationsInput
  executionTx?: string | StringFieldUpdateOperationsInput
  slashedAt?: number | IntFieldUpdateOperationsInput
  block?: BlockUpdateOneRequiredWithoutSlashInput
}

export type SlashUpdateManyMutationInput = {
  proposer?: string | StringFieldUpdateOperationsInput
  reason?: string | StringFieldUpdateOperationsInput
  executionTx?: string | StringFieldUpdateOperationsInput
  slashedAt?: number | IntFieldUpdateOperationsInput
}

export type HeaderCreateInput = {
  hash: string
  proposer: string
  parentBlock: string
  fee: string
  utxoRoot: string
  utxoIndex: string
  nullifierRoot: string
  withdrawalRoot: string
  withdrawalIndex: string
  txRoot: string
  depositRoot: string
  migrationRoot: string
  Block?: BlockCreateManyWithoutHeaderInput
}

export type HeaderUpdateInput = {
  hash?: string | StringFieldUpdateOperationsInput
  proposer?: string | StringFieldUpdateOperationsInput
  parentBlock?: string | StringFieldUpdateOperationsInput
  fee?: string | StringFieldUpdateOperationsInput
  utxoRoot?: string | StringFieldUpdateOperationsInput
  utxoIndex?: string | StringFieldUpdateOperationsInput
  nullifierRoot?: string | StringFieldUpdateOperationsInput
  withdrawalRoot?: string | StringFieldUpdateOperationsInput
  withdrawalIndex?: string | StringFieldUpdateOperationsInput
  txRoot?: string | StringFieldUpdateOperationsInput
  depositRoot?: string | StringFieldUpdateOperationsInput
  migrationRoot?: string | StringFieldUpdateOperationsInput
  Block?: BlockUpdateManyWithoutHeaderInput
}

export type HeaderUpdateManyMutationInput = {
  hash?: string | StringFieldUpdateOperationsInput
  proposer?: string | StringFieldUpdateOperationsInput
  parentBlock?: string | StringFieldUpdateOperationsInput
  fee?: string | StringFieldUpdateOperationsInput
  utxoRoot?: string | StringFieldUpdateOperationsInput
  utxoIndex?: string | StringFieldUpdateOperationsInput
  nullifierRoot?: string | StringFieldUpdateOperationsInput
  withdrawalRoot?: string | StringFieldUpdateOperationsInput
  withdrawalIndex?: string | StringFieldUpdateOperationsInput
  txRoot?: string | StringFieldUpdateOperationsInput
  depositRoot?: string | StringFieldUpdateOperationsInput
  migrationRoot?: string | StringFieldUpdateOperationsInput
}

export type BootstrapCreateInput = {
  id?: string
  utxoBootstrap: string
  withdrawalBootstrap: string
  block?: BlockCreateOneWithoutBootstrapInput
}

export type BootstrapUpdateInput = {
  id?: string | StringFieldUpdateOperationsInput
  utxoBootstrap?: string | StringFieldUpdateOperationsInput
  withdrawalBootstrap?: string | StringFieldUpdateOperationsInput
  block?: BlockUpdateOneWithoutBootstrapInput
}

export type BootstrapUpdateManyMutationInput = {
  id?: string | StringFieldUpdateOperationsInput
  utxoBootstrap?: string | StringFieldUpdateOperationsInput
  withdrawalBootstrap?: string | StringFieldUpdateOperationsInput
}

export type MassDepositCreateInput = {
  index: string
  merged: string
  fee: string
  blockNumber: number
  includedIn?: string | null
}

export type MassDepositUpdateInput = {
  index?: string | StringFieldUpdateOperationsInput
  merged?: string | StringFieldUpdateOperationsInput
  fee?: string | StringFieldUpdateOperationsInput
  blockNumber?: number | IntFieldUpdateOperationsInput
  includedIn?: string | NullableStringFieldUpdateOperationsInput | null
}

export type MassDepositUpdateManyMutationInput = {
  index?: string | StringFieldUpdateOperationsInput
  merged?: string | StringFieldUpdateOperationsInput
  fee?: string | StringFieldUpdateOperationsInput
  blockNumber?: number | IntFieldUpdateOperationsInput
  includedIn?: string | NullableStringFieldUpdateOperationsInput | null
}

export type DepositCreateInput = {
  note: string
  fee: string
  transactionIndex: number
  logIndex: number
  blockNumber: number
  queuedAt: string
}

export type DepositUpdateInput = {
  note?: string | StringFieldUpdateOperationsInput
  fee?: string | StringFieldUpdateOperationsInput
  transactionIndex?: number | IntFieldUpdateOperationsInput
  logIndex?: number | IntFieldUpdateOperationsInput
  blockNumber?: number | IntFieldUpdateOperationsInput
  queuedAt?: string | StringFieldUpdateOperationsInput
}

export type DepositUpdateManyMutationInput = {
  note?: string | StringFieldUpdateOperationsInput
  fee?: string | StringFieldUpdateOperationsInput
  transactionIndex?: number | IntFieldUpdateOperationsInput
  logIndex?: number | IntFieldUpdateOperationsInput
  blockNumber?: number | IntFieldUpdateOperationsInput
  queuedAt?: string | StringFieldUpdateOperationsInput
}

export type UtxoCreateInput = {
  hash: string
  eth?: string | null
  owner?: string | null
  salt?: string | null
  tokenAddr?: string | null
  erc20Amount?: string | null
  nft?: string | null
  status?: number | null
  treeId?: string | null
  index?: string | null
  nullifier?: string | null
  usedAt?: string | null
}

export type UtxoUpdateInput = {
  hash?: string | StringFieldUpdateOperationsInput
  eth?: string | NullableStringFieldUpdateOperationsInput | null
  owner?: string | NullableStringFieldUpdateOperationsInput | null
  salt?: string | NullableStringFieldUpdateOperationsInput | null
  tokenAddr?: string | NullableStringFieldUpdateOperationsInput | null
  erc20Amount?: string | NullableStringFieldUpdateOperationsInput | null
  nft?: string | NullableStringFieldUpdateOperationsInput | null
  status?: number | NullableIntFieldUpdateOperationsInput | null
  treeId?: string | NullableStringFieldUpdateOperationsInput | null
  index?: string | NullableStringFieldUpdateOperationsInput | null
  nullifier?: string | NullableStringFieldUpdateOperationsInput | null
  usedAt?: string | NullableStringFieldUpdateOperationsInput | null
}

export type UtxoUpdateManyMutationInput = {
  hash?: string | StringFieldUpdateOperationsInput
  eth?: string | NullableStringFieldUpdateOperationsInput | null
  owner?: string | NullableStringFieldUpdateOperationsInput | null
  salt?: string | NullableStringFieldUpdateOperationsInput | null
  tokenAddr?: string | NullableStringFieldUpdateOperationsInput | null
  erc20Amount?: string | NullableStringFieldUpdateOperationsInput | null
  nft?: string | NullableStringFieldUpdateOperationsInput | null
  status?: number | NullableIntFieldUpdateOperationsInput | null
  treeId?: string | NullableStringFieldUpdateOperationsInput | null
  index?: string | NullableStringFieldUpdateOperationsInput | null
  nullifier?: string | NullableStringFieldUpdateOperationsInput | null
  usedAt?: string | NullableStringFieldUpdateOperationsInput | null
}

export type WithdrawalCreateInput = {
  hash: string
  withdrawalHash: string
  eth: string
  owner?: string | null
  salt?: string | null
  tokenAddr: string
  erc20Amount: string
  nft: string
  to: string
  fee: string
  status?: number | null
  treeId?: string | null
  index?: string | null
  includedIn?: string | null
  prepayer?: string | null
  siblings?: string | null
}

export type WithdrawalUpdateInput = {
  hash?: string | StringFieldUpdateOperationsInput
  withdrawalHash?: string | StringFieldUpdateOperationsInput
  eth?: string | StringFieldUpdateOperationsInput
  owner?: string | NullableStringFieldUpdateOperationsInput | null
  salt?: string | NullableStringFieldUpdateOperationsInput | null
  tokenAddr?: string | StringFieldUpdateOperationsInput
  erc20Amount?: string | StringFieldUpdateOperationsInput
  nft?: string | StringFieldUpdateOperationsInput
  to?: string | StringFieldUpdateOperationsInput
  fee?: string | StringFieldUpdateOperationsInput
  status?: number | NullableIntFieldUpdateOperationsInput | null
  treeId?: string | NullableStringFieldUpdateOperationsInput | null
  index?: string | NullableStringFieldUpdateOperationsInput | null
  includedIn?: string | NullableStringFieldUpdateOperationsInput | null
  prepayer?: string | NullableStringFieldUpdateOperationsInput | null
  siblings?: string | NullableStringFieldUpdateOperationsInput | null
}

export type WithdrawalUpdateManyMutationInput = {
  hash?: string | StringFieldUpdateOperationsInput
  withdrawalHash?: string | StringFieldUpdateOperationsInput
  eth?: string | StringFieldUpdateOperationsInput
  owner?: string | NullableStringFieldUpdateOperationsInput | null
  salt?: string | NullableStringFieldUpdateOperationsInput | null
  tokenAddr?: string | StringFieldUpdateOperationsInput
  erc20Amount?: string | StringFieldUpdateOperationsInput
  nft?: string | StringFieldUpdateOperationsInput
  to?: string | StringFieldUpdateOperationsInput
  fee?: string | StringFieldUpdateOperationsInput
  status?: number | NullableIntFieldUpdateOperationsInput | null
  treeId?: string | NullableStringFieldUpdateOperationsInput | null
  index?: string | NullableStringFieldUpdateOperationsInput | null
  includedIn?: string | NullableStringFieldUpdateOperationsInput | null
  prepayer?: string | NullableStringFieldUpdateOperationsInput | null
  siblings?: string | NullableStringFieldUpdateOperationsInput | null
}

export type MigrationCreateInput = {
  hash: string
  eth?: string | null
  owner?: string | null
  salt?: string | null
  tokenAddr?: string | null
  erc20Amount?: string | null
  nft?: string | null
  to?: string | null
  fee?: string | null
  status?: number | null
  treeId?: string | null
  index?: string | null
  usedFor?: string | null
}

export type MigrationUpdateInput = {
  hash?: string | StringFieldUpdateOperationsInput
  eth?: string | NullableStringFieldUpdateOperationsInput | null
  owner?: string | NullableStringFieldUpdateOperationsInput | null
  salt?: string | NullableStringFieldUpdateOperationsInput | null
  tokenAddr?: string | NullableStringFieldUpdateOperationsInput | null
  erc20Amount?: string | NullableStringFieldUpdateOperationsInput | null
  nft?: string | NullableStringFieldUpdateOperationsInput | null
  to?: string | NullableStringFieldUpdateOperationsInput | null
  fee?: string | NullableStringFieldUpdateOperationsInput | null
  status?: number | NullableIntFieldUpdateOperationsInput | null
  treeId?: string | NullableStringFieldUpdateOperationsInput | null
  index?: string | NullableStringFieldUpdateOperationsInput | null
  usedFor?: string | NullableStringFieldUpdateOperationsInput | null
}

export type MigrationUpdateManyMutationInput = {
  hash?: string | StringFieldUpdateOperationsInput
  eth?: string | NullableStringFieldUpdateOperationsInput | null
  owner?: string | NullableStringFieldUpdateOperationsInput | null
  salt?: string | NullableStringFieldUpdateOperationsInput | null
  tokenAddr?: string | NullableStringFieldUpdateOperationsInput | null
  erc20Amount?: string | NullableStringFieldUpdateOperationsInput | null
  nft?: string | NullableStringFieldUpdateOperationsInput | null
  to?: string | NullableStringFieldUpdateOperationsInput | null
  fee?: string | NullableStringFieldUpdateOperationsInput | null
  status?: number | NullableIntFieldUpdateOperationsInput | null
  treeId?: string | NullableStringFieldUpdateOperationsInput | null
  index?: string | NullableStringFieldUpdateOperationsInput | null
  usedFor?: string | NullableStringFieldUpdateOperationsInput | null
}

export type TreeNodeCreateInput = {
  treeId: string
  nodeIndex: string
  value: string
}

export type TreeNodeUpdateInput = {
  treeId?: string | StringFieldUpdateOperationsInput
  nodeIndex?: string | StringFieldUpdateOperationsInput
  value?: string | StringFieldUpdateOperationsInput
}

export type TreeNodeUpdateManyMutationInput = {
  treeId?: string | StringFieldUpdateOperationsInput
  nodeIndex?: string | StringFieldUpdateOperationsInput
  value?: string | StringFieldUpdateOperationsInput
}

export type LightTreeCreateInput = {
  id?: string
  species: number
  start: string
  end: string
  root: string
  index: string
  siblings: string
}

export type LightTreeUpdateInput = {
  id?: string | StringFieldUpdateOperationsInput
  species?: number | IntFieldUpdateOperationsInput
  start?: string | StringFieldUpdateOperationsInput
  end?: string | StringFieldUpdateOperationsInput
  root?: string | StringFieldUpdateOperationsInput
  index?: string | StringFieldUpdateOperationsInput
  siblings?: string | StringFieldUpdateOperationsInput
}

export type LightTreeUpdateManyMutationInput = {
  id?: string | StringFieldUpdateOperationsInput
  species?: number | IntFieldUpdateOperationsInput
  start?: string | StringFieldUpdateOperationsInput
  end?: string | StringFieldUpdateOperationsInput
  root?: string | StringFieldUpdateOperationsInput
  index?: string | StringFieldUpdateOperationsInput
  siblings?: string | StringFieldUpdateOperationsInput
}

export type TokenRegistryCreateInput = {
  address: string
  isERC20: boolean
  isERC721: boolean
  identifier: number
  blockNumber: number
}

export type TokenRegistryUpdateInput = {
  address?: string | StringFieldUpdateOperationsInput
  isERC20?: boolean | BoolFieldUpdateOperationsInput
  isERC721?: boolean | BoolFieldUpdateOperationsInput
  identifier?: number | IntFieldUpdateOperationsInput
  blockNumber?: number | IntFieldUpdateOperationsInput
}

export type TokenRegistryUpdateManyMutationInput = {
  address?: string | StringFieldUpdateOperationsInput
  isERC20?: boolean | BoolFieldUpdateOperationsInput
  isERC721?: boolean | BoolFieldUpdateOperationsInput
  identifier?: number | IntFieldUpdateOperationsInput
  blockNumber?: number | IntFieldUpdateOperationsInput
}

export type StringFilter = {
  equals?: string
  in?: Enumerable<string>
  notIn?: Enumerable<string>
  lt?: string
  lte?: string
  gt?: string
  gte?: string
  contains?: string
  startsWith?: string
  endsWith?: string
  not?: string | NestedStringFilter
}

export type IntFilter = {
  equals?: number
  in?: Enumerable<number>
  notIn?: Enumerable<number>
  lt?: number
  lte?: number
  gt?: number
  gte?: number
  not?: number | NestedIntFilter
}

export type NetworkIdChainIdAddressCompoundUniqueInput = {
  networkId: number
  chainId: number
  address: string
}

export type StringNullableFilter = {
  equals?: string | null
  in?: Enumerable<string> | null
  notIn?: Enumerable<string> | null
  lt?: string | null
  lte?: string | null
  gt?: string | null
  gte?: string | null
  contains?: string | null
  startsWith?: string | null
  endsWith?: string | null
  not?: string | NestedStringNullableFilter | null
}

export type IntNullableFilter = {
  equals?: number | null
  in?: Enumerable<number> | null
  notIn?: Enumerable<number> | null
  lt?: number | null
  lte?: number | null
  gt?: number | null
  gte?: number | null
  not?: number | NestedIntNullableFilter | null
}

export type BoolNullableFilter = {
  equals?: boolean | null
  not?: boolean | NestedBoolNullableFilter | null
}

export type BlockRelationFilter = {
  is?: BlockWhereInput | null
  isNot?: BlockWhereInput | null
}

export type HeaderRelationFilter = {
  is?: HeaderWhereInput | null
  isNot?: HeaderWhereInput | null
}

export type ProposalRelationFilter = {
  is?: ProposalWhereInput | null
  isNot?: ProposalWhereInput | null
}

export type BootstrapRelationFilter = {
  is?: BootstrapWhereInput | null
  isNot?: BootstrapWhereInput | null
}

export type SlashRelationFilter = {
  is?: SlashWhereInput | null
  isNot?: SlashWhereInput | null
}

export type BlockListRelationFilter = {
  every?: BlockWhereInput
  some?: BlockWhereInput
  none?: BlockWhereInput
}

export type TreeIdNodeIndexCompoundUniqueInput = {
  treeId: string
  nodeIndex: string
}

export type BoolFilter = {
  equals?: boolean
  not?: boolean | NestedBoolFilter
}

export type StringFieldUpdateOperationsInput = {
  set?: string
}

export type IntFieldUpdateOperationsInput = {
  set?: number
}

export type NullableStringFieldUpdateOperationsInput = {
  set?: string | null
}

export type BlockCreateOneWithoutProposalInput = {
  create?: BlockCreateWithoutProposalInput
  connect?: BlockWhereUniqueInput
}

export type NullableIntFieldUpdateOperationsInput = {
  set?: number | null
}

export type NullableBoolFieldUpdateOperationsInput = {
  set?: boolean | null
}

export type BlockUpdateOneWithoutProposalInput = {
  create?: BlockCreateWithoutProposalInput
  connect?: BlockWhereUniqueInput
  disconnect?: boolean
  delete?: boolean
  update?: BlockUpdateWithoutProposalDataInput
  upsert?: BlockUpsertWithoutProposalInput
}

export type HeaderCreateOneWithoutBlockInput = {
  create?: HeaderCreateWithoutBlockInput
  connect?: HeaderWhereUniqueInput
}

export type ProposalCreateOneWithoutBlockInput = {
  create?: ProposalCreateWithoutBlockInput
  connect?: ProposalWhereUniqueInput
}

export type BootstrapCreateOneWithoutBlockInput = {
  create?: BootstrapCreateWithoutBlockInput
  connect?: BootstrapWhereUniqueInput
}

export type SlashCreateOneWithoutBlockInput = {
  create?: SlashCreateWithoutBlockInput
  connect?: SlashWhereUniqueInput
}

export type HeaderUpdateOneRequiredWithoutBlockInput = {
  create?: HeaderCreateWithoutBlockInput
  connect?: HeaderWhereUniqueInput
  update?: HeaderUpdateWithoutBlockDataInput
  upsert?: HeaderUpsertWithoutBlockInput
}

export type ProposalUpdateOneRequiredWithoutBlockInput = {
  create?: ProposalCreateWithoutBlockInput
  connect?: ProposalWhereUniqueInput
  update?: ProposalUpdateWithoutBlockDataInput
  upsert?: ProposalUpsertWithoutBlockInput
}

export type BootstrapUpdateOneWithoutBlockInput = {
  create?: BootstrapCreateWithoutBlockInput
  connect?: BootstrapWhereUniqueInput
  disconnect?: boolean
  delete?: boolean
  update?: BootstrapUpdateWithoutBlockDataInput
  upsert?: BootstrapUpsertWithoutBlockInput
}

export type SlashUpdateOneWithoutBlockInput = {
  create?: SlashCreateWithoutBlockInput
  connect?: SlashWhereUniqueInput
  disconnect?: boolean
  delete?: boolean
  update?: SlashUpdateWithoutBlockDataInput
  upsert?: SlashUpsertWithoutBlockInput
}

export type BlockCreateOneWithoutSlashInput = {
  create?: BlockCreateWithoutSlashInput
  connect?: BlockWhereUniqueInput
}

export type BlockUpdateOneRequiredWithoutSlashInput = {
  create?: BlockCreateWithoutSlashInput
  connect?: BlockWhereUniqueInput
  update?: BlockUpdateWithoutSlashDataInput
  upsert?: BlockUpsertWithoutSlashInput
}

export type BlockCreateManyWithoutHeaderInput = {
  create?: Enumerable<BlockCreateWithoutHeaderInput>
  connect?: Enumerable<BlockWhereUniqueInput>
}

export type BlockUpdateManyWithoutHeaderInput = {
  create?: Enumerable<BlockCreateWithoutHeaderInput>
  connect?: Enumerable<BlockWhereUniqueInput>
  set?: Enumerable<BlockWhereUniqueInput>
  disconnect?: Enumerable<BlockWhereUniqueInput>
  delete?: Enumerable<BlockWhereUniqueInput>
  update?: Enumerable<BlockUpdateWithWhereUniqueWithoutHeaderInput>
  updateMany?: Enumerable<BlockUpdateManyWithWhereNestedInput> | null
  deleteMany?: Enumerable<BlockScalarWhereInput>
  upsert?: Enumerable<BlockUpsertWithWhereUniqueWithoutHeaderInput>
}

export type BlockCreateOneWithoutBootstrapInput = {
  create?: BlockCreateWithoutBootstrapInput
  connect?: BlockWhereUniqueInput
}

export type BlockUpdateOneWithoutBootstrapInput = {
  create?: BlockCreateWithoutBootstrapInput
  connect?: BlockWhereUniqueInput
  disconnect?: boolean
  delete?: boolean
  update?: BlockUpdateWithoutBootstrapDataInput
  upsert?: BlockUpsertWithoutBootstrapInput
}

export type BoolFieldUpdateOperationsInput = {
  set?: boolean
}

export type NestedStringFilter = {
  equals?: string
  in?: Enumerable<string>
  notIn?: Enumerable<string>
  lt?: string
  lte?: string
  gt?: string
  gte?: string
  contains?: string
  startsWith?: string
  endsWith?: string
  not?: NestedStringFilter | null
}

export type NestedIntFilter = {
  equals?: number
  in?: Enumerable<number>
  notIn?: Enumerable<number>
  lt?: number
  lte?: number
  gt?: number
  gte?: number
  not?: NestedIntFilter | null
}

export type NestedStringNullableFilter = {
  equals?: string | null
  in?: Enumerable<string> | null
  notIn?: Enumerable<string> | null
  lt?: string | null
  lte?: string | null
  gt?: string | null
  gte?: string | null
  contains?: string | null
  startsWith?: string | null
  endsWith?: string | null
  not?: NestedStringNullableFilter | null
}

export type NestedIntNullableFilter = {
  equals?: number | null
  in?: Enumerable<number> | null
  notIn?: Enumerable<number> | null
  lt?: number | null
  lte?: number | null
  gt?: number | null
  gte?: number | null
  not?: NestedIntNullableFilter | null
}

export type NestedBoolNullableFilter = {
  equals?: boolean | null
  not?: NestedBoolNullableFilter | null
}

export type NestedBoolFilter = {
  equals?: boolean
  not?: NestedBoolFilter | null
}

export type BlockCreateWithoutProposalInput = {
  header: HeaderCreateOneWithoutBlockInput
  bootstrap?: BootstrapCreateOneWithoutBlockInput
  slash?: SlashCreateOneWithoutBlockInput
}

export type BlockUpdateWithoutProposalDataInput = {
  header?: HeaderUpdateOneRequiredWithoutBlockInput
  bootstrap?: BootstrapUpdateOneWithoutBlockInput
  slash?: SlashUpdateOneWithoutBlockInput
}

export type BlockUpsertWithoutProposalInput = {
  update: BlockUpdateWithoutProposalDataInput
  create: BlockCreateWithoutProposalInput
}

export type HeaderCreateWithoutBlockInput = {
  hash: string
  proposer: string
  parentBlock: string
  fee: string
  utxoRoot: string
  utxoIndex: string
  nullifierRoot: string
  withdrawalRoot: string
  withdrawalIndex: string
  txRoot: string
  depositRoot: string
  migrationRoot: string
}

export type ProposalCreateWithoutBlockInput = {
  hash: string
  proposalNum?: number | null
  proposedAt?: number | null
  proposalTx?: string | null
  proposalData?: string | null
  finalized?: boolean | null
  verified?: boolean | null
  isUncle?: boolean | null
}

export type BootstrapCreateWithoutBlockInput = {
  id?: string
  utxoBootstrap: string
  withdrawalBootstrap: string
}

export type SlashCreateWithoutBlockInput = {
  proposer: string
  reason: string
  executionTx: string
  slashedAt: number
}

export type HeaderUpdateWithoutBlockDataInput = {
  hash?: string | StringFieldUpdateOperationsInput
  proposer?: string | StringFieldUpdateOperationsInput
  parentBlock?: string | StringFieldUpdateOperationsInput
  fee?: string | StringFieldUpdateOperationsInput
  utxoRoot?: string | StringFieldUpdateOperationsInput
  utxoIndex?: string | StringFieldUpdateOperationsInput
  nullifierRoot?: string | StringFieldUpdateOperationsInput
  withdrawalRoot?: string | StringFieldUpdateOperationsInput
  withdrawalIndex?: string | StringFieldUpdateOperationsInput
  txRoot?: string | StringFieldUpdateOperationsInput
  depositRoot?: string | StringFieldUpdateOperationsInput
  migrationRoot?: string | StringFieldUpdateOperationsInput
}

export type HeaderUpsertWithoutBlockInput = {
  update: HeaderUpdateWithoutBlockDataInput
  create: HeaderCreateWithoutBlockInput
}

export type ProposalUpdateWithoutBlockDataInput = {
  hash?: string | StringFieldUpdateOperationsInput
  proposalNum?: number | NullableIntFieldUpdateOperationsInput | null
  proposedAt?: number | NullableIntFieldUpdateOperationsInput | null
  proposalTx?: string | NullableStringFieldUpdateOperationsInput | null
  proposalData?: string | NullableStringFieldUpdateOperationsInput | null
  finalized?: boolean | NullableBoolFieldUpdateOperationsInput | null
  verified?: boolean | NullableBoolFieldUpdateOperationsInput | null
  isUncle?: boolean | NullableBoolFieldUpdateOperationsInput | null
}

export type ProposalUpsertWithoutBlockInput = {
  update: ProposalUpdateWithoutBlockDataInput
  create: ProposalCreateWithoutBlockInput
}

export type BootstrapUpdateWithoutBlockDataInput = {
  id?: string | StringFieldUpdateOperationsInput
  utxoBootstrap?: string | StringFieldUpdateOperationsInput
  withdrawalBootstrap?: string | StringFieldUpdateOperationsInput
}

export type BootstrapUpsertWithoutBlockInput = {
  update: BootstrapUpdateWithoutBlockDataInput
  create: BootstrapCreateWithoutBlockInput
}

export type SlashUpdateWithoutBlockDataInput = {
  proposer?: string | StringFieldUpdateOperationsInput
  reason?: string | StringFieldUpdateOperationsInput
  executionTx?: string | StringFieldUpdateOperationsInput
  slashedAt?: number | IntFieldUpdateOperationsInput
}

export type SlashUpsertWithoutBlockInput = {
  update: SlashUpdateWithoutBlockDataInput
  create: SlashCreateWithoutBlockInput
}

export type BlockCreateWithoutSlashInput = {
  header: HeaderCreateOneWithoutBlockInput
  proposal: ProposalCreateOneWithoutBlockInput
  bootstrap?: BootstrapCreateOneWithoutBlockInput
}

export type BlockUpdateWithoutSlashDataInput = {
  header?: HeaderUpdateOneRequiredWithoutBlockInput
  proposal?: ProposalUpdateOneRequiredWithoutBlockInput
  bootstrap?: BootstrapUpdateOneWithoutBlockInput
}

export type BlockUpsertWithoutSlashInput = {
  update: BlockUpdateWithoutSlashDataInput
  create: BlockCreateWithoutSlashInput
}

export type BlockCreateWithoutHeaderInput = {
  proposal: ProposalCreateOneWithoutBlockInput
  bootstrap?: BootstrapCreateOneWithoutBlockInput
  slash?: SlashCreateOneWithoutBlockInput
}

export type BlockUpdateWithWhereUniqueWithoutHeaderInput = {
  where: BlockWhereUniqueInput
  data: BlockUpdateWithoutHeaderDataInput
}

export type BlockUpdateManyWithWhereNestedInput = {
  where: BlockScalarWhereInput
  data: BlockUpdateManyDataInput
}

export type BlockScalarWhereInput = {
  AND?: Enumerable<BlockScalarWhereInput>
  OR?: Array<BlockScalarWhereInput>
  NOT?: Enumerable<BlockScalarWhereInput>
  hash?: string | StringFilter
}

export type BlockUpsertWithWhereUniqueWithoutHeaderInput = {
  where: BlockWhereUniqueInput
  update: BlockUpdateWithoutHeaderDataInput
  create: BlockCreateWithoutHeaderInput
}

export type BlockCreateWithoutBootstrapInput = {
  header: HeaderCreateOneWithoutBlockInput
  proposal: ProposalCreateOneWithoutBlockInput
  slash?: SlashCreateOneWithoutBlockInput
}

export type BlockUpdateWithoutBootstrapDataInput = {
  header?: HeaderUpdateOneRequiredWithoutBlockInput
  proposal?: ProposalUpdateOneRequiredWithoutBlockInput
  slash?: SlashUpdateOneWithoutBlockInput
}

export type BlockUpsertWithoutBootstrapInput = {
  update: BlockUpdateWithoutBootstrapDataInput
  create: BlockCreateWithoutBootstrapInput
}

export type BlockUpdateWithoutHeaderDataInput = {
  proposal?: ProposalUpdateOneRequiredWithoutBlockInput
  bootstrap?: BootstrapUpdateOneWithoutBlockInput
  slash?: SlashUpdateOneWithoutBlockInput
}

export type BlockUpdateManyDataInput = {

}

/**
 * Batch Payload for updateMany & deleteMany
 */

export type BatchPayload = {
  count: number
}

/**
 * DMMF
 */
export declare const dmmf: DMMF.Document;
export {};
