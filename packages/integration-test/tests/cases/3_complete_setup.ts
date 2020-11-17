/* eslint-disable jest/no-expect-resolves */
/* eslint-disable jest/require-tothrow-message */
/* eslint-disable jest/no-export */
/* eslint-disable jest/require-top-level-describe */

import { toWei } from 'web3-utils'
import { sleep } from '@zkopru/utils'
import { Layer1 } from '@zkopru/contracts'
import { Address } from 'soltypes'
import { ZkWallet } from '@zkopru/zk-wizard'
import { verifyingKeyIdentifier } from '@zkopru/core'
import { CtxProvider } from './context'

export const testCompleteSetup = (ctx: CtxProvider) => async () => {
  const { accounts, contract } = ctx()
  const tx = contract.setup.methods.completeSetup()
  const gas = await tx.estimateGas()
  await expect(
    tx.send({ from: accounts.alice.ethAddress, gas }),
  ).rejects.toThrow()
  await expect(
    tx.send({ from: accounts.bob.ethAddress, gas }),
  ).rejects.toThrow()
  await expect(
    tx.send({ from: accounts.carl.ethAddress, gas }),
  ).rejects.toThrow()
  await expect(
    tx.send({ from: accounts.coordinator.ethAddress, gas }),
  ).resolves.toHaveProperty('transactionHash')
}

export const testRejectVkRegistration = (ctx: CtxProvider) => async () => {
  const { accounts, contract } = ctx()
  const tx = contract.setup.methods.completeSetup()
  await expect(
    tx.estimateGas({ from: accounts.alice.ethAddress }),
  ).rejects.toThrow()
  await expect(
    tx.estimateGas({ from: accounts.bob.ethAddress }),
  ).rejects.toThrow()
  await expect(
    tx.estimateGas({ from: accounts.carl.ethAddress }),
  ).rejects.toThrow()
  await expect(
    tx.estimateGas({ from: accounts.coordinator.ethAddress }),
  ).rejects.toThrow()
}

export const registerCoordinator = (ctx: CtxProvider) => async () => {
  const { wallets, web3, contract } = ctx()
  const consensus = await contract.upstream.methods.consensusProvider().call()
  await wallets.coordinator.sendLayer1Tx({
    contract: consensus,
    tx: Layer1.getIBurnAuction(web3, consensus).methods.register(),
    option: {
      value: toWei('32', 'ether'),
    },
  })
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
  const { wallets, contract, tokens } = ctx()
  const registerERC20Tx = contract.coordinator.methods.registerERC20(
    tokens.erc20.address,
  )
  await wallets.coordinator.sendLayer1Tx({
    contract: contract.address,
    tx: registerERC20Tx,
  })
  const registerERC721Tx = contract.coordinator.methods.registerERC721(
    tokens.erc721.address,
  )
  await wallets.coordinator.sendLayer1Tx({
    contract: contract.address,
    tx: registerERC721Tx,
  })
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
  do {
    const aliceSyncedNewTokenRegistration = await isSynced(wallets.alice)
    const bobSyncedNewTokenRegistration = await isSynced(wallets.bob)
    const carlSyncedNewTokenRegistration = await isSynced(wallets.carl)
    synced =
      aliceSyncedNewTokenRegistration &&
      bobSyncedNewTokenRegistration &&
      carlSyncedNewTokenRegistration
    if (!synced) await sleep(500)
  } while (!synced)
}
