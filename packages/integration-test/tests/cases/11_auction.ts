import chai from 'chai'
import { BigNumber } from 'ethers'
import { parseEther, parseUnits } from 'ethers/lib/utils'
import { BurnAuction } from '@zkopru/contracts'
import { CtxProvider } from '../context'

const { expect } = chai

export const testInvalidBid = (ctx: CtxProvider) => async () => {
  const { wallets } = ctx()
  const { newCoordinator } = wallets

  const newCoordinatorAccount = newCoordinator.accounts[0].ethAccount!
  const burnAuction = (await newCoordinator.coordinatorManager.burnAuction()) as BurnAuction
  const newCoordinatorAuction = burnAuction.connect(newCoordinatorAccount)

  // try bid before stake ether
  const biddableRound = await burnAuction.earliestBiddableRound()
  const bidTx = await newCoordinatorAuction.populateTransaction['bid(uint256)'](
    biddableRound,
    {
      value: parseUnits(`20000`, 'gwei'),
      gasLimit: 1000000, // if not set will be error
    },
  )
  await expect(newCoordinatorAccount.sendTransaction(bidTx)).to.be.reverted
}

export const stakeForBeingCoordintor = (ctx: CtxProvider) => async () => {
  const { wallets } = ctx()
  const { newCoordinator } = wallets

  const newCoordinatorAddr = newCoordinator.accounts[0].ethAddress
  const newCoordinatorAccount = newCoordinator.accounts[0].ethAccount!
  const burnAuction = (await newCoordinator.coordinatorManager.burnAuction()) as BurnAuction
  const newCoordinatorAuction = burnAuction.connect(newCoordinatorAccount)

  // stake ether to be coordinator
  expect(
    await newCoordinator.node.layer1.zkopru.isStaked(newCoordinatorAddr),
  ).to.eq(false)
  try {
    const registerTx = await newCoordinatorAuction.register({
      value: parseEther('32'),
    })
    const registerTxReceipt = await registerTx.wait()
    if (registerTxReceipt.status !== 1) throw new Error(`tx failed`)
  } catch (error) {
    console.warn(`newCoordinator register error: ${error}`)
  }
  expect(
    await newCoordinator.node.layer1.zkopru.isStaked(newCoordinatorAddr),
  ).to.eq(true)
}

export const setUrlForActiveCoordinator = (ctx: CtxProvider) => async () => {
  const URL = `http://localhost:8889` // exist coordinator url is http://localhost:8888

  const { wallets } = ctx()
  const { newCoordinator } = wallets

  const newCoordinatorAddr = newCoordinator.accounts[0].ethAddress
  const newCoordinatorAccount = newCoordinator.accounts[0].ethAccount!
  const burnAuction = (await newCoordinator.coordinatorManager.burnAuction()) as BurnAuction
  const newCoordinatorAuction = burnAuction.connect(newCoordinatorAccount)

  // set url to be coordinator
  let newCoordinatorUrl = await newCoordinatorAuction.coordinatorUrls(
    newCoordinatorAddr,
  )
  expect(newCoordinatorUrl).to.eq('')

  try {
    const setUrlTx = await newCoordinatorAuction.setUrl(URL)
    const setUrlTxRecipt = await setUrlTx.wait()
    if (setUrlTxRecipt.status !== 1) throw new Error(`tx failed`)
  } catch (error) {
    console.warn(`newCoordinator setUrl error: ${error}`)
  }
  newCoordinatorUrl = await newCoordinatorAuction.coordinatorUrls(
    newCoordinatorAddr,
  )
  expect(newCoordinatorUrl).to.eq(URL)
}

// Describe bidding test scenario
// Let assume that the coordinator is 'A' and the new coordinator 'B'
//
//
// Initial auction states
//
//    highest bidder-  0   0   0   0   0   0   0   0   0   0   0   0
//    slot position  -11 -10  -9  -8  -7  -6  -5  -4  -3  -2  -1   L
//
// 1. 'A' bid slots from +0 to +11 using `multiBid` method.
//
//    highest bidder - A   A   A   A   A   A   A   A   A   A   A   0
//    slot position  -11 -10  -9  -8  -7  -6  -5  -4  -3  -2  -1   L
//
// 2. 'B' bid slot at +5
//                                         *
//    highest bidder - A   A   A   A   A   B   A   A   A   A   A   0
//    slot position  -11 -10  -9  -8  -7  -6  -5  -4  -3  -2  -1   L
//
// 3. 'A' bid again slots from 0 to 10 using 'multiBid' with higher bid amount
//                                         *
//    highest bidder - A   A   A   A   A   A   A   A   A   A   A   0
//    slot position  -11 -10  -9  -8  -7  -6  -5  -4  -3  -2  -1   L

export const initializeAuctionConditions = async (ctx: CtxProvider) => {
  const { wallets, coordinator: contextCoordinator } = ctx()
  const { coordinator } = wallets

  const coordinatorAddr = coordinator.accounts[0].ethAddress
  const coordinatorAccount = coordinator.accounts[0].ethAccount!

  const burnAuction = await coordinator.coordinatorManager.burnAuction() // as BurnAuction
  const coordinatorAuction = burnAuction.connect(
    coordinatorAccount,
  ) as BurnAuction

  // stop active coordinator
  await contextCoordinator.stop()

  // the coordinator bid slots, from earliest biddable slot to advanced 10 more
  // i.e, Assume that `earliest biddable` is 10. the coordinator bid slots from 10 to 20.
  const round = (await coordinatorAuction.latestBiddableRound()) as BigNumber
  const targetRound = round.sub(5) as BigNumber
  const minBid = (await coordinatorAuction.minBid()) as BigNumber
  const minNextBid = (await coordinatorAuction.minNextBid(round)) as BigNumber

  // check pending amount and empty bid history in auction contract
  let coordinatorPendingValue = await coordinatorAuction.pendingBalances(
    coordinatorAddr,
  )
  if (coordinatorPendingValue.toNumber() !== 0) {
    try {
      const refundTx = await coordinatorAuction['refund()']()
      const refundTxReceipt = await refundTx.wait()
      if (refundTxReceipt.status !== 1) throw new Error(`tx failed`)
      coordinatorPendingValue = await coordinatorAuction.pendingBalances(
        coordinatorAddr,
      )
      expect(coordinatorPendingValue.toNumber()).to.eq(0)
    } catch (error) {
      console.warn(`coordinator refund error: ${error}`)
    }
  }

  for (let i = round.toNumber(); i > round.toNumber() - 11; i = i - 1) {
    const {
      0: amount,
      1: bidder,
    } = await coordinatorAuction.highestBidForRound(i)
    expect(amount.toString()).to.eq(minBid.toString())
    expect(bidder).to.eq('0x0000000000000000000000000000000000000000')
  }
  return {
    round,
    targetRound,
    minBid,
    minNextBid,
  }
}

export const bidSlotsByCoordinator = (
  ctx: CtxProvider,
  getBidArguments: () => {
    round: BigNumber
    minBid: BigNumber
    minNextBid: BigNumber
  },
) => async () => {
  const { wallets } = ctx()
  const { coordinator } = wallets
  const bidArguments = getBidArguments()
  const { round, minBid, minNextBid } = bidArguments

  const coordinatorAddr = coordinator.accounts[0].ethAddress
  const coordinatorAccount = coordinator.accounts[0].ethAccount!

  const burnAuction = await coordinator.coordinatorManager.burnAuction() // as BurnAuction
  const coordinatorAuction = burnAuction.connect(
    coordinatorAccount,
  ) as BurnAuction

  // coordinator bid rounds via multiBid method
  try {
    // target rounds are between round and round+10, but sending value for round+11. +1 is for testing 'pendingBalance'
    const multiBidTx = await coordinatorAuction.multiBid(
      minNextBid,
      minNextBid,
      round.sub(10),
      round.sub(1),
      { value: minNextBid.mul(11) }, // Should remain as amount one `minNextBid`
    )
    const multiBidTxReceipt = await multiBidTx.wait()
    if (multiBidTxReceipt.status !== 1) throw new Error(`tx failed`)
  } catch (error) {
    console.warn(`coordinator multiBid Error: ${error}`)
  }

  // check remaining pending value and updated bid states by the coordinator
  const coordinatorPendingValue = await coordinatorAuction.pendingBalances(
    coordinatorAddr,
  )
  expect(coordinatorPendingValue).to.eq(minNextBid)

  for (let i = round.toNumber() - 1; i > round.toNumber() - 10; i = i - 1) {
    const {
      0: amount,
      1: bidder,
    } = await coordinatorAuction.highestBidForRound(i)
    expect(amount.toString()).to.eq(minNextBid.toString())
    expect(bidder).to.eq(coordinatorAddr)
  }

  // check boundary, status of a slot over the last bid
  const { 0: amount, 1: bidder } = await coordinatorAuction.highestBidForRound(
    round,
  )
  expect(amount.toString()).to.eq(minBid.toString())
  expect(bidder).to.eq('0x0000000000000000000000000000000000000000')
}

export const bidSlotByNewCoordinator = (
  ctx: CtxProvider,
  getBidArguments: any,
) => async () => {
  const { wallets } = ctx()
  const { newCoordinator } = wallets
  const bidArguments = getBidArguments()
  const { targetRound } = bidArguments

  const newCoordinatorAddr = newCoordinator.accounts[0].ethAddress
  const newCoordinatorAccount = newCoordinator.accounts[0].ethAccount!

  const burnAuction = await newCoordinator.coordinatorManager.burnAuction()
  const newCoordinatorAuction = burnAuction.connect(
    newCoordinatorAccount,
  ) as BurnAuction

  // newCoordinator bid one of slots which winning coordinator
  const newBidAmount = parseUnits('30000', 'gwei')
  try {
    const bidTx = await newCoordinatorAuction['bid(uint256)'](targetRound, {
      value: newBidAmount,
    })
    const bidTxReceipt = await bidTx.wait()
    if (bidTxReceipt.status !== 1) throw new Error(`tx failed`)
  } catch (error) {
    console.warn(
      `newCoordinator bidding ${targetRound} round slot transaction error: ${error}`,
    )
  }

  const {
    0: updatedAmount,
    1: updatedBidder,
  } = await newCoordinatorAuction.highestBidForRound(targetRound)
  expect(updatedAmount.toString()).to.eq(newBidAmount.toString())
  expect(updatedBidder).to.eq(newCoordinatorAddr)
}

export const bidSlotsAgainByCoordinator = (
  ctx: CtxProvider,
  getBidArguments: any,
) => async () => {
  const { wallets } = ctx()
  const { coordinator } = wallets
  const bidArguments = getBidArguments()
  const { round, targetRound, minNextBid } = bidArguments

  const coordinatorAddr = coordinator.accounts[0].ethAddress
  const coordinatorAccount = coordinator.accounts[0].ethAccount!

  const burnAuction = await coordinator.coordinatorManager.burnAuction() // as BurnAuction
  const coordinatorAuction = burnAuction.connect(
    coordinatorAccount,
  ) as BurnAuction

  let coordinatorPendingValue = await coordinatorAuction.pendingBalances(
    coordinatorAddr,
  )

  // bid slot 'targetRound' with using multiBid method.
  try {
    const maxNextBid = await coordinatorAuction.minNextBid(targetRound)
    const value = maxNextBid.sub(coordinatorPendingValue) // use exist pendingValue for bid
    const multiBidTx = await coordinatorAuction.multiBid(
      minNextBid.add(1),
      maxNextBid,
      round.sub(10),
      round.sub(1),
      { value },
    )
    const multiBidTxReceipt = await multiBidTx.wait()
    if (multiBidTxReceipt.status !== 1) throw new Error(`tx failed`)
  } catch (error) {
    console.warn(`coordinator multiBid Error: ${error}`)
  }

  coordinatorPendingValue = await coordinatorAuction.pendingBalances(
    coordinatorAddr,
  )
  for (let i = round.toNumber() - 1; i > round.toNumber() - 11; i = i - 1) {
    const { 1: bidder } = await coordinatorAuction.highestBidForRound(i)
    expect(bidder).to.eq(coordinatorAddr)
  }
}
