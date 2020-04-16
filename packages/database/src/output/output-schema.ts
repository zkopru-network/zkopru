export interface NoteSql {
  hash: string
  tree: string
  index: string
  eth?: string
  pubKey?: string
  salt?: string
  tokenAddr?: string
  erc20Amount?: string
  nft?: string
  type?: number
  withdrawOutTo?: string
  fee?: string
}
