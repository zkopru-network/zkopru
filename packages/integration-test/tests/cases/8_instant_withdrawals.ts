import chai from 'chai'
import { WithdrawalStatus } from '~transaction'
import { sleep } from '~utils'
import { Address, Uint256 } from 'soltypes'
import { parseUnits } from 'ethers/lib/utils'
import { BigNumber } from 'ethers'
import { CtxProvider } from '../context'

const { expect } = chai

export const testGetWithdrawablesOfAlice = (ctx: CtxProvider) => async () => {
  const { wallets, accounts } = ctx()
  const { alice } = wallets
  expect(
    await alice.getWithdrawables(accounts.alice, WithdrawalStatus.UNFINALIZED),
  ).to.have.length(1)
}

export const testGetWithdrawablesOfBob = (ctx: CtxProvider) => async () => {
  const { wallets, accounts } = ctx()
  const { bob } = wallets
  expect(
    await bob.getWithdrawables(accounts.bob, WithdrawalStatus.UNFINALIZED),
  ).to.have.length(1)
}

export const testGetWithdrawablesOfCarl = (ctx: CtxProvider) => async () => {
  const { wallets, accounts } = ctx()
  const { carl } = wallets
  expect(
    await carl.getWithdrawables(accounts.carl, WithdrawalStatus.UNFINALIZED),
  ).to.have.length(1)
}

export const payForEthWithdrawalInAdvance = (ctx: CtxProvider) => async () => {
  const { wallets, accounts, coordinator, fixtureProvider } = ctx()
  const withdrawals = await wallets.bob.getWithdrawables(
    accounts.bob,
    WithdrawalStatus.UNFINALIZED,
  )
  expect(withdrawals).to.have.length(1)
  let updated = false
  do {
    const bobLatestBlock = await wallets.bob.node.layer2.latestBlock()
    const coordinatorLatestBlock = await coordinator.node().layer2.latestBlock()
    if (bobLatestBlock.eq(coordinatorLatestBlock)) {
      updated = true
      break
    }
    await fixtureProvider.advanceBlock(8)
    await sleep(1000)
  } while (!updated)
  const prevBalance = await wallets.bob.fetchLayer1Assets(accounts.bob)
  const ethWithdrawal = withdrawals[0]
  const prepayFeeInEth = Uint256.from(parseUnits('100', 'gwei').toString())
  const prepayFeeInToken = Uint256.from('0')
  const currentBlockNum = await wallets.bob.node.layer1.provider.getBlockNumber()
  const currentBlock = await wallets.bob.node.layer1.provider.getBlock(
    currentBlockNum,
  )
  const currentTimestamp = parseInt(`${currentBlock.timestamp}`, 10)
  const result = await wallets.bob.instantWithdrawal(
    Address.from(accounts.coordinator.ethAddress),
    prepayFeeInEth,
    prepayFeeInToken,
    ethWithdrawal,
    currentTimestamp + 300,
  )
  const nextBalance = await wallets.bob.fetchLayer1Assets(accounts.bob)
  expect(result).to.be.true
  expect(nextBalance.eth).to.eq(
    BigNumber.from(prevBalance.eth)
      .add(ethWithdrawal.eth)
      .sub(prepayFeeInEth.toBigNumber())
      .toString(),
  )
}
