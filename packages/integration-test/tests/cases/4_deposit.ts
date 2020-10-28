/* eslint-disable jest/no-expect-resolves */
/* eslint-disable jest/require-tothrow-message */
/* eslint-disable jest/no-export */
/* eslint-disable jest/require-top-level-describe */

import { toWei } from 'web3-utils'
import { sleep } from '@zkopru/utils'
import { CtxProvider } from './context'

export const depositEther = (ctx: CtxProvider) => async () => {
  const { wallets } = ctx()
  await expect(
    wallets.alice.depositEther(toWei('10', 'ether'), toWei('1', 'milliether')),
  ).resolves.toStrictEqual(true)
  await expect(
    wallets.bob.depositEther(toWei('10', 'ether'), toWei('1', 'milliether')),
  ).resolves.toStrictEqual(true)
  await expect(
    wallets.carl.depositEther(toWei('10', 'ether'), toWei('1', 'milliether')),
  ).resolves.toStrictEqual(true)
}

export const bobDepositsErc20 = (ctx: CtxProvider) => async () => {
  const { wallets, accounts, tokens, zkopruAddress } = ctx()
  // Get airdrop for the initial balance
  await wallets.coordinator.sendLayer1Tx({
    contract: tokens.erc20.address,
    tx: tokens.erc20.contract.methods.transfer(
      accounts.bob.ethAddress,
      toWei('100', 'ether'),
    ),
  })
  // Approve
  const amount = toWei('10', 'ether')
  await wallets.bob.sendLayer1Tx({
    contract: tokens.erc20.address,
    tx: tokens.erc20.contract.methods.approve(zkopruAddress, amount),
  })
  // Deposit ERC20
  await expect(
    wallets.bob.depositERC20(
      toWei('0', 'ether'),
      tokens.erc20.address,
      amount,
      toWei('1', 'milliether'),
    ),
  ).resolves.toStrictEqual(true)
}

export const depositERC721 = (ctx: CtxProvider) => async () => {
  const { wallets, accounts, tokens, zkopruAddress } = ctx()
  // Send NFT '0' to carl
  await wallets.coordinator.sendLayer1Tx({
    contract: tokens.erc721.address,
    tx: tokens.erc721.contract.methods.safeTransferFrom(
      accounts.coordinator.ethAddress,
      accounts.carl.ethAddress,
      '1',
    ),
  })
  // Approve
  await wallets.carl.sendLayer1Tx({
    contract: tokens.erc721.address,
    tx: tokens.erc721.contract.methods.setApprovalForAll(zkopruAddress, true),
  })
  // Deposit NFT id 1
  await expect(
    wallets.carl.depositERC721(
      toWei('0', 'ether'),
      tokens.erc721.address,
      '1',
      toWei('1', 'milliether'),
    ),
  ).resolves.toStrictEqual(true)
}

export const testMassDeposits = (ctx: CtxProvider) => async () => {
  const { coordinator } = ctx()
  await coordinator.commitMassDepositTask()
  await sleep(1000)
  const pendingMassDeposits = await coordinator
    .layer2()
    .getPendingMassDeposits()
  expect(pendingMassDeposits.leaves).toHaveLength(5)
}
