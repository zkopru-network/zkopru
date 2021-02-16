export enum RpcType {
  http = 0,
}

export interface RpcConfig {
  type: RpcType
  url: string
}

export interface Block {
  proposalNum: number
  // TODO
}

export interface Tx {
  hash: string
}

export interface Registry {
  erc20s: string[]
  erc721s: string[]
}
