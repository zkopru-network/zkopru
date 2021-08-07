/* eslint-disable jest/no-truthy-falsy */
/* eslint-disable jest/no-expect-resolves */
/* eslint-disable jest/require-tothrow-message */
/* eslint-disable jest/no-export */
/* eslint-disable jest/require-top-level-describe */

import { toWei } from 'web3-utils'
import { TxBuilder, Utxo, ZkTx } from '@zkopru/transaction'
import { Fp } from '@zkopru/babyjubjub'
import { sleep } from '@zkopru/utils'
import { Bytes32, Uint256 } from 'soltypes'
import { Block } from '@zkopru/core'
import { CtxProvider } from './context'

export const buildZkTxAliceSendEthToBob = async (
  ctx: CtxProvider,
): Promise<ZkTx> => {
  const { wallets, accounts } = ctx()
  const aliceWallet = wallets.alice
  const { alice } = accounts
  const { bob } = accounts

  const alicePrevBalance = await aliceWallet.getSpendableAmount(alice)
  const aliceSpendables: Utxo[] = await aliceWallet.getSpendables(alice)
  const aliceRawTx = TxBuilder.from(alice.zkAddress)
    .provide(...aliceSpendables.map(note => Utxo.from(note)))
    .weiPerByte(toWei('100000', 'gwei'))
    .sendEther({
      eth: Fp.from(toWei('1', 'ether')),
      to: bob.zkAddress,
    })
    .build()
  const aliceZkTx = await aliceWallet.shieldTx({
    tx: aliceRawTx,
  })
  const aliceNewBalance = await aliceWallet.getSpendableAmount(alice)
  const aliceLockedAmount = await aliceWallet.getLockedAmount(alice)
  expect(aliceNewBalance.eth.add(aliceLockedAmount.eth)).toBe(
    alicePrevBalance.eth,
  )
  return aliceZkTx
}

export const buildZkTxBobSendEthToCarl = async (
  ctx: CtxProvider,
): Promise<ZkTx> => {
  const { wallets, accounts } = ctx()
  const bobWallet = wallets.bob
  const { bob } = accounts
  const { carl } = accounts

  const bobPrevBalance = await bobWallet.getSpendableAmount(bob)
  const bobSpendables: Utxo[] = await bobWallet.getSpendables(bob)
  const bobPrevLocked = await bobWallet.getLockedAmount(bob)
  const bobRawTx = TxBuilder.from(bob.zkAddress)
    .provide(...bobSpendables.map(note => Utxo.from(note)))
    .weiPerByte(toWei('100000', 'gwei'))
    .sendEther({
      eth: Fp.from(toWei('1', 'ether')),
      to: carl.zkAddress,
    })
    .build()
  const bobZkTx = await bobWallet.shieldTx({
    tx: bobRawTx,
  })
  const bobNewBalance = await bobWallet.getSpendableAmount(bob)
  const bobLockedAmount = await bobWallet.getLockedAmount(bob)
  expect(bobNewBalance.eth.add(bobLockedAmount.eth)).toBe(
    bobPrevBalance.eth.add(bobPrevLocked.eth),
  )
  return bobZkTx
}

export const buildZkTxCarlSendEthToAlice = async (
  ctx: CtxProvider,
): Promise<ZkTx> => {
  const { wallets, accounts } = ctx()
  const carlWallet = wallets.carl
  const { carl } = accounts
  const { alice } = accounts

  const carlPrevBalance = await carlWallet.getSpendableAmount(carl)
  const carlSpendables: Utxo[] = await carlWallet.getSpendables(carl)
  const carlRawTx = TxBuilder.from(carl.zkAddress)
    .provide(...carlSpendables.map(note => Utxo.from(note)))
    .weiPerByte(toWei('100000', 'gwei'))
    .sendEther({
      eth: Fp.from(toWei('1', 'ether')),
      to: alice.zkAddress,
    })
    .build()
  const carlZkTx = await carlWallet.shieldTx({
    tx: carlRawTx,
  })
  const carlNewBalance = await carlWallet.getSpendableAmount(carl)
  const carlLockedAmount = await carlWallet.getLockedAmount(carl)
  expect(carlNewBalance.eth.add(carlLockedAmount.eth)).toBe(carlPrevBalance.eth)
  return carlZkTx
}

export const testRound3SendZkTxsToCoordinator = (
  ctx: CtxProvider,
  txs: () => {
    aliceTransfer: ZkTx
    bobTransfer: ZkTx
    carlTransfer: ZkTx
  },
) => async () => {
  const { wallets } = ctx()
  const { aliceTransfer, bobTransfer, carlTransfer } = txs()
  const r = await wallets.alice.sendLayer2Tx([
    aliceTransfer,
    bobTransfer,
    carlTransfer,
  ])
  expect(r.status).toStrictEqual(200)
}

export const testRound3NewBlockProposalAndSlashing = (
  ctx: CtxProvider,
  subCtx: () => { prevLatestBlock: Bytes32 },
) => async () => {
  const { wallets, coordinator } = ctx()
  const { prevLatestBlock } = subCtx()
  let slashed = !(await coordinator.context.node.layer1.upstream.methods
    .isProposable(coordinator.context.account.address)
    .call())
  coordinator.middlewares.proposer.setPreProcessor(block => {
    const cloned = Block.from(block.serializeBlock())
    cloned.header.utxoRoot = Uint256.from(
      block.header.utxoRoot
        .toBN()
        .addn(1)
        .toString(),
    )
    return cloned
  })
  let wait = 600000
  do {
    slashed = !(await coordinator.context.node.layer1.upstream.methods
      .isProposable(coordinator.context.account.address)
      .call())
    await sleep(1000)
    wait -= 1000
  } while (!slashed && wait > 0)
  // Should be slashed
  expect(slashed).toBeTruthy()
  const aliceLatestBlock = await wallets.alice.node.layer2.latestBlock()
  const bobLatestBlock = await wallets.bob.node.layer2.latestBlock()
  const carlLatestBlock = await wallets.carl.node.layer2.latestBlock()
  const coordinatorLatestBlock = await coordinator.node().layer2.latestBlock()
  // Nodes should throw away the slashed block
  expect(aliceLatestBlock.eq(prevLatestBlock)).toBeTruthy()
  expect(bobLatestBlock.eq(prevLatestBlock)).toBeTruthy()
  expect(carlLatestBlock.eq(prevLatestBlock)).toBeTruthy()
  expect(coordinatorLatestBlock.eq(prevLatestBlock)).toBeTruthy()
  coordinator.middlewares.proposer.removePreProcessor()
}
