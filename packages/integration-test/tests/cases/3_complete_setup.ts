import chai from 'chai'

import { sleep } from '~utils'
import { Address } from 'soltypes'
import { ZkWallet } from '~zk-wizard'
import { verifyingKeyIdentifier } from '~core'
import { CtxProvider } from '../context'

const { expect } = chai

export const testCompleteSetup = (ctx: CtxProvider) => async () => {
  const { accounts, contract } = ctx()
  console.log('Now Genesis!')
  const tx = await contract.zkopru.populateTransaction.completeSetup()
  console.log('Genesis!')
  await expect(accounts.alice.ethAccount!.sendTransaction(tx)).to.be.reverted
  await expect(accounts.bob.ethAccount!.sendTransaction(tx)).to.be.reverted
  await expect(accounts.carl.ethAccount!.sendTransaction(tx)).to.be.reverted
  const response = await accounts.coordinator.ethAccount!.sendTransaction(tx)
  const receipt = await response.wait()
  expect(receipt.status).to.eq(1)
}

export const testRejectVkRegistration = (ctx: CtxProvider) => async () => {
  const { accounts, contract } = ctx()
  const tx = await contract.setup.populateTransaction.completeSetup()

  await expect(accounts.alice.ethAccount!.sendTransaction(tx)).to.be.reverted
  await expect(accounts.bob.ethAccount!.sendTransaction(tx)).to.be.reverted
  await expect(accounts.carl.ethAccount!.sendTransaction(tx)).to.be.reverted
  await expect(accounts.newCoordinator.ethAccount!.sendTransaction(tx)).to.be
    .reverted
  await expect(accounts.coordinator.ethAccount!.sendTransaction(tx)).to.be
    .reverted
}

export const updateVerifyingKeys = (ctx: CtxProvider) => async () => {
  const { wallets, contract, coordinator } = ctx()
  const vks = await contract.getVKs()
  const NUM_OF_INPUTS = 4
  const NUM_OF_OUTPUTS = 4
  for (let nI = 1; nI <= NUM_OF_INPUTS; nI += 1) {
    for (let nO = 1; nO <= NUM_OF_OUTPUTS; nO += 1) {
      const sig = verifyingKeyIdentifier(nI, nO)
      wallets.alice.node.layer2.snarkVerifier.addVerifyingKey(nI, nO, vks[sig])
      wallets.bob.node.layer2.snarkVerifier.addVerifyingKey(nI, nO, vks[sig])
      wallets.carl.node.layer2.snarkVerifier.addVerifyingKey(nI, nO, vks[sig])
      wallets.coordinator.node.layer2.snarkVerifier.addVerifyingKey(
        nI,
        nO,
        vks[sig],
      )
      coordinator.node().layer2.snarkVerifier.addVerifyingKey(nI, nO, vks[sig])
    }
  }
}

export const testRegisterTokens = (ctx: CtxProvider) => async () => {
  const { accounts, contract, tokens, wallets, fixtureProvider } = ctx()
  console.log('register!')
  await contract.coordinator
    .connect(accounts.coordinator.ethAccount!)
    .registerERC20(tokens.erc20.address)
  await contract.coordinator
    .connect(accounts.coordinator.ethAccount!)
    .registerERC721(tokens.erc721.address)
  const isSynced = async (wallet: ZkWallet) => {
    const tokenRegistry = await wallet.node.layer2.getTokenRegistry()
    const erc20Sync = !!tokenRegistry.erc20s.find(addr =>
      addr.eq(Address.from(tokens.erc20.address)),
    )
    const erc721Sync = !!tokenRegistry.erc721s.find(addr =>
      addr.eq(Address.from(tokens.erc721.address)),
    )
    return !!(erc20Sync && erc721Sync)
  }
  let synced = false
  await fixtureProvider.advanceBlock(10)
  do {
    // console.log(wallets.alice.node.layer2)
    const aliceSyncedNewTokenRegistration = await isSynced(wallets.alice)
    const bobSyncedNewTokenRegistration = await isSynced(wallets.bob)
    const carlSyncedNewTokenRegistration = await isSynced(wallets.carl)
    synced =
      aliceSyncedNewTokenRegistration &&
      bobSyncedNewTokenRegistration &&
      carlSyncedNewTokenRegistration
    if (!synced) await sleep(500)
  } while (!synced)
  expect(synced).to.eq(true)
}
