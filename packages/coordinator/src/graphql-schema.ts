export const typeDefs = `
type Query {
  price: Price!
  pendingTxs: [ZkTx!]!
}

type Mutation {
  sendZkTx(tx: ZkTx!): Boolean!
  sendEncodedTx(encoded: String!): Boolean!
}

type Price {
  weiPerByte: String!
}

type ZkTx {
  inflow: [ZkInflow!]!
  outflow: [ZkOutflow!]!
  fee: String!
  proof: SNARK!
  swap: String
  memo: String
}

type ZkInlfow {
  nullifer: String!
  root: String!
}

type ZkOutflow {
  note: String!
  outflowType: Int!
  data: PublicData
}

type PublicData {
  to: String!
  eth: String!
  tokenAddr: String!
  erc20Amount: String!
  nft: String!
  fee: String!
}

type SNARK {
  pi_a: [String!]!
  pi_b: [[String!]!]!
  pi_c: [String!]!
}
`
