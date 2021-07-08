const testnetHost = process.env.TESTNET_HOST ?? 'testnet:5000'

export const config = {
  mnemonic:
    'myth like bonus scare over problem client lizard pioneer submit female collect',
  zkopruContract: '0x970e8f18ebfEa0B08810f33a5A40438b9530FBCF',
  auctionContract: '0xaf5C4C6C7920B4883bC6252e9d9B8fE27187Cf68',
  testnetUrl: `ws://${testnetHost}`,
  networkId: 20200406,
  chainId: 1,
  genesisHash:
    '0xd1e363805bd72496bc8655758c5e3ef06482a0fa7fa64779d67663bd5f4ff73b',
  mainQueueLimit: process.env.queueLimit ?? 100,
}
