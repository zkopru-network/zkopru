import chai from 'chai'
import { Sum, SwapTxBuilder, Utxo, ZkTx } from '~transaction'
import { Fp } from '~babyjubjub'
import { sleep } from '~utils'
import { parseUnits } from 'ethers/lib/utils'
import { Bytes32 } from 'soltypes'
import { CtxProvider } from '../context'

const { expect } = chai

const WEI_PER_BYTE = parseUnits('100000', 'gwei')

export const buildZkSwapTxAliceSendEthToBobAndReceiveERC20 = async (
  ctx: CtxProvider,
): Promise<ZkTx> => {
  const { wallets, accounts, tokens } = ctx()
  const tokenAddr = tokens.erc20.address
  const aliceWallet = wallets.alice
  const { alice, bob } = accounts

  const alicePrevBalance = await aliceWallet.getSpendableAmount(alice)
  const aliceSpendables: Utxo[] = await aliceWallet.getSpendables(alice)
  const alicePrevLocked = await aliceWallet.getLockedAmount(alice)

  const aliceRawTx = SwapTxBuilder.from(alice.zkAddress)
    .provide(...aliceSpendables.map(note => Utxo.from(note)))
    .weiPerByte(WEI_PER_BYTE)
    .sendEther({
      eth: Fp.from(parseUnits('1', 'ether')),
      to: bob.zkAddress,
      salt: 1, // salt of new ETH note bob receives
    })
    .receiveERC20({
      tokenAddr,
      erc20Amount: Fp.from(parseUnits('1', 'ether')),
      salt: 2, // salt of new ERC20 note alice receives
    })
    .build()

  const aliceZkTx = await aliceWallet.shieldTx({
    tx: aliceRawTx,
  })

  const aliceNewBalance = await aliceWallet.getSpendableAmount(alice)
  const aliceLockedAmount = await aliceWallet.getLockedAmount(alice)

  expect(aliceNewBalance.eth.add(aliceLockedAmount.eth)).to.eq(
    alicePrevBalance.eth.add(alicePrevLocked.eth),
  )

  return aliceZkTx
}

export const buildZkSwapTxBobSendERC20ToAliceAndReceiveEther = async (
  ctx: CtxProvider,
): Promise<ZkTx> => {
  const { wallets, accounts, tokens } = ctx()
  const tokenAddr = tokens.erc20.address
  const bobWallet = wallets.bob
  const { alice, bob } = accounts

  const bobPrevBalance = await bobWallet.getSpendableAmount(bob)
  const bobSpendables: Utxo[] = await bobWallet.getSpendables(bob)
  const bobPrevLocked = await bobWallet.getLockedAmount(bob)
  const bobRawTx = SwapTxBuilder.from(bob.zkAddress)
    .provide(...bobSpendables.map(note => Utxo.from(note)))
    .weiPerByte(WEI_PER_BYTE)
    .sendERC20({
      tokenAddr,
      erc20Amount: Fp.from(parseUnits('1', 'ether')),
      to: alice.zkAddress,
      salt: 2, // salt of new ERC20 note alice receives
    })
    .receiveEther(
      Fp.from(parseUnits('1', 'ether')),
      1, // salt of new ETH note bob receives
    )
    .build()

  const bobZkTx = await bobWallet.shieldTx({
    tx: bobRawTx,
  })

  const bobNewBalance = await bobWallet.getSpendableAmount(bob)
  const bobLockedAmount = await bobWallet.getLockedAmount(bob)
  expect(
    (bobNewBalance.erc20[tokenAddr] || Fp.zero).add(
      bobLockedAmount.erc20[tokenAddr] || Fp.zero,
    ),
  ).to.eq(
    (bobPrevBalance.erc20[tokenAddr] || Fp.zero).add(
      bobPrevLocked.erc20[tokenAddr] || Fp.zero,
    ),
  )

  return bobZkTx
}

export const testRound4SendZkTxsToCoordinator = (
  ctx: CtxProvider,
  txs: () => {
    aliceSwap: ZkTx
    bobSwap: ZkTx
  },
) => async () => {
  const { wallets } = ctx()
  const { aliceSwap, bobSwap } = txs()
  const r = await wallets.alice.sendLayer2Tx([aliceSwap, bobSwap])
  expect(r.status).to.eq(200)
}

export const testRound4NewBlockProposal = (
  ctx: CtxProvider,
  subCtx: () => {
    prevLatestBlock: Bytes32
  },
) => async () => {
  const { wallets, coordinator, fixtureProvider } = ctx()
  const { prevLatestBlock } = subCtx()
  let updated = false
  let newBlockHash!: Bytes32
  do {
    const aliceLatestBlock = await wallets.alice.node.layer2.latestBlock()
    const bobLatestBlock = await wallets.bob.node.layer2.latestBlock()
    const coordinatorLatestBlock = await coordinator.node().layer2.latestBlock()
    if (
      aliceLatestBlock.eq(bobLatestBlock) &&
      aliceLatestBlock.eq(coordinatorLatestBlock) &&
      !aliceLatestBlock.eq(prevLatestBlock)
    ) {
      updated = true
      newBlockHash = aliceLatestBlock
      break
    }
    await fixtureProvider.advanceBlock(8)
    await sleep(1000)
  } while (!updated)
  const newBlock = await wallets.alice.node.layer2.getBlock(newBlockHash)
  expect(newBlock?.body.txs).to.have.length(2)
}

export const testRound4NewSpendableUtxos = (
  ctx: CtxProvider,
  subCtx: () => {
    aliceSpendablesBefore: Sum
    bobSpendablesBefore: Sum
    aliceSwap: ZkTx
    bobSwap: ZkTx
  },
) => async () => {
  const { wallets, tokens } = ctx()
  const {
    aliceSpendablesBefore,
    bobSpendablesBefore,
    aliceSwap,
    bobSwap,
  } = subCtx()
  const tokenAddr = tokens.erc20.address

  const aliceBalanceAfter = await wallets.alice.getSpendableAmount()
  const bobBalanceAfter = await wallets.bob.getSpendableAmount()

  const erc20Amount = parseUnits('1', 'ether')
  const ethAmount = parseUnits('1', 'ether')

  expect(aliceBalanceAfter.erc20[tokenAddr]).to.eq(
    (aliceSpendablesBefore.erc20[tokenAddr] || Fp.zero).add(erc20Amount),
  )
  expect(bobBalanceAfter.erc20[tokenAddr]).to.eq(
    (bobSpendablesBefore.erc20[tokenAddr] || Fp.zero).sub(erc20Amount),
  )

  expect(aliceBalanceAfter.eth).to.eq(
    (aliceSpendablesBefore.eth || Fp.zero).sub(ethAmount).sub(aliceSwap.fee),
  )
  expect(bobBalanceAfter.eth).to.eq(
    (bobSpendablesBefore.eth || Fp.zero).add(ethAmount).sub(bobSwap.fee),
  )
}
