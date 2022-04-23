import chai from 'chai'
import { parseEther, parseUnits } from 'ethers/lib/utils'
import { BurnAuction } from '@zkopru/contracts'
import { CtxProvider } from '../context'

const { expect } = chai

export const registerNewCoordinator = (ctx: CtxProvider) => async () => {
  const URL = `localhost:8889`

  const { wallets } = ctx()
  const { newCoordinator } = wallets

  const newCoordinatorAddr = newCoordinator.accounts[0].ethAddress
  const newCoordinatorAccount = newCoordinator.accounts[0].ethAccount
  const burnAuction = (await newCoordinator.coordinatorManager.burnAuction()) as BurnAuction
  const newCoordinatorAuction = burnAuction.connect(newCoordinatorAccount)

  // try bid before stake ether
  const biddableRound = burnAuction.earliestBiddableRound()
  const bidTx = await newCoordinatorAuction.populateTransaction['bid(uint256)'](
    biddableRound,
    {
      value: parseUnits(`20000`, 'gwei'),
      gasLimit: 1000000, // if not set will be error
    },
  )
  await expect(newCoordinatorAccount.sendTransaction(bidTx)).to.be.reverted

  // stake ether to be coordinator
  expect(
    await newCoordinator.node.layer1.zkopru.isStaked(newCoordinatorAddr),
  ).to.eq(false)
  try {
    const registerTx = await newCoordinatorAuction.register({
      value: parseEther('32'),
    })
    const registerTxReceipt = await registerTx.wait()
    if (registerTxReceipt.status != 1) throw new Error(`tx failed`)
  } catch (error) {
    console.warn(`register error: ${error}`)
  }
  expect(
    await newCoordinator.node.layer1.zkopru.isStaked(newCoordinatorAddr),
  ).to.eq(true)

  // set url to be coordinator
  let coordinatorUrl = await newCoordinatorAuction.coordinatorUrls(
    newCoordinatorAddr,
  )
  expect(coordinatorUrl).to.eq('')

  try {
    const setUrlTx = await newCoordinatorAuction.setUrl(URL)
    const setUrlTxRecipt = await setUrlTx.wait()
    if (setUrlTxRecipt.status != 1) throw new Error(`tx failed`)
  } catch (error) {
    console.warn(`setUrl error: ${error}`)
  }
  coordinatorUrl = await newCoordinatorAuction.coordinatorUrls(
    newCoordinatorAddr,
  )
  expect(coordinatorUrl).to.eq(URL)
}

export const bidAuctionEachOther = (ctx: CtxProvider) => async () => {
  const { wallets } = ctx()
  const { coordinator, newCoordinator } = wallets

  const nullAddress = '0x0000000000000000000000000000000000000000'
  const coordinatorAddr = coordinator.accounts[0].ethAddress
  const coordinatorAccount = coordinator.accounts[0].ethAccount
  const newCoordinatorAddr = newCoordinator.accounts[0].ethAddress
  const newCoordinatorAccount = newCoordinator.accounts[0].ethAccount

  const burnAuction = await coordinator.coordinatorManager.burnAuction() // as BurnAuction
  const coordinatorAuction = burnAuction.connect(
    coordinatorAccount,
  ) as BurnAuction
  const newCoordinatorAuction = burnAuction.connect(
    newCoordinatorAccount,
  ) as BurnAuction

  // 1. the coordinator bid slots, from earliest biddable slot to advanced 10 more
  // i.e, Assume that `earliest biddable` is 10. the coordinator bid slots from 10 to 20.
  const round = await coordinatorAuction.earliestBiddableRound()
  const minBid = await coordinatorAuction.minBid()
  const minNextBid = await coordinatorAuction.minNextBid(round)

  // check pending amount and empty bid history in auction contract
  let coordinatorPendingValue = await coordinatorAuction.pendingBalances(
    coordinatorAddr,
  )
  expect(coordinatorPendingValue.toNumber()).to.eq(0)

  for (let i = round.toNumber(); i < round.toNumber() + 11; i++) {
    const {
      0: amount,
      1: bidder,
    } = await coordinatorAuction.highestBidForRound(i)
    expect(amount.toString()).to.eq(minBid.toString())
    expect(bidder).to.eq(nullAddress)
  }

  // coordinator bid rounds via multiBid method
  try {
    // target rounds are between round and round+10, but sending value for round+11. +1 is for testing 'pendingBalance'
    const multiBidTx = await coordinatorAuction.multiBid(
      minNextBid,
      minNextBid,
      round,
      round.add(9),
      { value: minNextBid.mul(11) },
    )
    const multiBidTxReceipt = await multiBidTx.wait()
    if (multiBidTxReceipt.status != 1) throw new Error(`tx failed`)
  } catch (error) {
    console.warn(`coordinator multiBid Error: ${error}`)
  }

  // check remaining pending value and updated bid states by the coordinator
  coordinatorPendingValue = await coordinatorAuction.pendingBalances(
    coordinatorAddr,
  )
  expect(coordinatorPendingValue).to.eq(minNextBid)

  for (let i = round.toNumber(); i < round.toNumber() + 10; i++) {
    const {
      0: amount,
      1: bidder,
    } = await coordinatorAuction.highestBidForRound(i)
    expect(amount.toString()).to.eq(minNextBid.toString())
    expect(bidder).to.eq(coordinatorAddr)
  }

  // check status of a slot over the last bid
  const { 0: amount, 1: bidder } = await coordinatorAuction.highestBidForRound(
    round.add(11),
  )
  expect(amount.toString()).to.eq(minBid.toString())
  expect(bidder).to.eq(nullAddress)

  // 2. newCoordinator bid one of slots which winning coordinator
  const targetRound = round.add(5)
  const newBidAmount = parseUnits('30000', 'gwei')
  try {
    const bidTx = await newCoordinatorAuction['bid(uint256)'](targetRound, {
      value: newBidAmount,
    })
    const bidTxReceipt = await bidTx.wait()
    if (bidTxReceipt.status != 1) throw new Error(`tx failed`)
  } catch (error) {
    console.warn(
      `newCoordinator bidding ${targetRound} round slot transaction error: ${error}`,
    )
  }
  const {
    0: updatedAmount,
    1: updatedBidder,
  } = await coordinatorAuction.highestBidForRound(targetRound)
  expect(updatedAmount.toString()).to.eq(newBidAmount.toString())
  expect(updatedBidder).to.eq(newCoordinatorAddr)

  coordinatorPendingValue = await coordinatorAuction.pendingBalances(
    coordinatorAddr,
  )

  // 3. coordinator take back highest bidder at 'targetRound' via multiBid method.
  try {
    const maxNextBid = await coordinatorAuction.minNextBid(targetRound)
    const value = maxNextBid.sub(coordinatorPendingValue) // use exist pendingValue for bid
    const multiBidTx = await coordinatorAuction.multiBid(
      minNextBid.add(1),
      maxNextBid,
      round,
      round.add(9),
      { value },
    )
    const multiBidTxReceipt = await multiBidTx.wait()
    if (multiBidTxReceipt.status != 1) throw new Error(`tx failed`)
  } catch (error) {
    console.warn(`coordinator multiBid Error: ${error}`)
  }

  coordinatorPendingValue = await coordinatorAuction.pendingBalances(
    coordinatorAddr,
  )
  for (let i = round.toNumber(); i < round.toNumber() + 10; i++) {
    const {
      0: amount,
      1: bidder,
    } = await coordinatorAuction.highestBidForRound(i)
    expect(bidder).to.eq(coordinatorAddr)
  }
}
