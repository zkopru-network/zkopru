/* eslint-disable jest/no-truthy-falsy */
/* eslint-disable jest/no-expect-resolves */
/* eslint-disable jest/require-tothrow-message */
/* eslint-disable jest/no-export */
/* eslint-disable jest/require-top-level-describe */

import { toWei, toBN } from 'web3-utils'
import { Sum, SwapTxBuilder, Utxo, ZkTx } from '@zkopru/transaction'
import { Fp } from '@zkopru/babyjubjub'
import { sleep } from '@zkopru/utils'
import { Bytes32 } from 'soltypes'
import { CtxProvider } from './context'

const WEI_PER_BYTE = toWei('100000', 'gwei')

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
      eth: Fp.from(toWei('1', 'ether')),
      to: bob.zkAddress,
      salt: 1, // salt of new ETH note bob receives
    })
    .receiveERC20({
      tokenAddr,
      erc20Amount: Fp.from(toWei('1', 'ether')),
      salt: 2, // salt of new ERC20 note alice receives
    })
    .build()

  const aliceZkTx = await aliceWallet.shieldTx({
    tx: aliceRawTx,
  })

  const aliceNewBalance = await aliceWallet.getSpendableAmount(alice)
  const aliceLockedAmount = await aliceWallet.getLockedAmount(alice)

  expect(aliceNewBalance.eth.add(aliceLockedAmount.eth)).toBe(
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
      erc20Amount: Fp.from(toWei('1', 'ether')),
      to: alice.zkAddress,
      salt: 2, // salt of new ERC20 note alice receives
    })
    .receiveEther(
      Fp.from(toWei('1', 'ether')),
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
  ).toBe(
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
  expect(r.status).toStrictEqual(200)
}

export const testRound4NewBlockProposal = (
  ctx: CtxProvider,
  subCtx: () => {
    prevLatestBlock: Bytes32
  },
) => async () => {
  const { wallets, coordinator } = ctx()
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
    await sleep(1000)
  } while (!updated)
  const newBlock = await wallets.alice.node.layer2.getBlock(newBlockHash)
  expect(newBlock?.body.txs).toHaveLength(2)
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

  const erc20Amount = toBN(toWei('1', 'ether'))
  const ethAmount = toBN(toWei('1', 'ether'))

  expect(
    aliceBalanceAfter.erc20[tokenAddr].eq(
      (aliceSpendablesBefore.erc20[tokenAddr] || Fp.zero).add(erc20Amount),
    ),
  ).toBeTruthy()
  expect(
    bobBalanceAfter.erc20[tokenAddr].eq(
      (bobSpendablesBefore.erc20[tokenAddr] || Fp.zero).sub(erc20Amount),
    ),
  ).toBeTruthy()

  expect(
    aliceBalanceAfter.eth.eq(
      (aliceSpendablesBefore.eth || Fp.zero).sub(ethAmount).sub(aliceSwap.fee),
    ),
  ).toBeTruthy()
  expect(
    bobBalanceAfter.eth.eq(
      (bobSpendablesBefore.eth || Fp.zero).add(ethAmount).sub(bobSwap.fee),
    ),
  ).toBeTruthy()
}
