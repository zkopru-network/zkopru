/* eslint-disable jest/no-truthy-falsy */
/* eslint-disable jest/no-expect-resolves */
/* eslint-disable jest/require-tothrow-message */
/* eslint-disable jest/no-export */
/* eslint-disable jest/require-top-level-describe */

import { toWei, toBN } from 'web3-utils'
import { TxBuilder, Utxo, ZkTx } from '@zkopru/transaction'
import { Field } from '@zkopru/babyjubjub'
import { sleep } from '@zkopru/utils'
import { Bytes32 } from 'soltypes'
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
      eth: Field.from(toWei('1', 'ether')),
      to: bob.zkAddress,
    })
    .build()
  const aliceZkTx = await aliceWallet.shieldTx({
    tx: aliceRawTx,
    encryptTo: bob.zkAddress,
  })
  const aliceNewBalance = await aliceWallet.getSpendableAmount(alice)
  const aliceLockedAmount = await aliceWallet.getLockedAmount(alice)
  expect(aliceNewBalance.eth.add(aliceLockedAmount.eth)).toBe(
    alicePrevBalance.eth,
  )
  // const aliceResponse = await aliceWallet.sendLayer2Tx(aliceZkTx)
  // expect(aliceResponse.status).toStrictEqual(200)
  return aliceZkTx
}

export const buildZkTxBobSendERC20ToCarl = async (
  ctx: CtxProvider,
): Promise<ZkTx> => {
  const { wallets, accounts, tokens } = ctx()
  const bobWallet = wallets.bob
  const { bob } = accounts
  const { carl } = accounts
  const tokenAddr = tokens.erc20.address
  const bobPrevBalance = (await bobWallet.getSpendableAmount(bob)).getERC20(
    tokenAddr,
  )
  const bobSpendables: Utxo[] = await bobWallet.getSpendables(bob)
  const bobRawTx = TxBuilder.from(bob.zkAddress)
    .provide(...bobSpendables.map(note => Utxo.from(note)))
    .weiPerByte(toWei('100000', 'gwei'))
    .sendERC20({
      eth: Field.zero,
      tokenAddr,
      erc20Amount: Field.from(toWei('1', 'ether')),
      to: carl.zkAddress,
    })
    .build()
  const bobZkTx = await bobWallet.shieldTx({
    tx: bobRawTx,
    encryptTo: carl.zkAddress,
  })
  // const response = await bobWallet.sendTx(bobRawTx)
  const bobNewBalance = (await bobWallet.getSpendableAmount(bob)).getERC20(
    tokenAddr,
  )
  const bobLockedAmount = (await bobWallet.getLockedAmount(bob)).getERC20(
    tokenAddr,
  )
  // expect(response.status).toStrictEqual(200)
  expect(bobNewBalance.add(bobLockedAmount)).toBe(bobPrevBalance)
  return bobZkTx
}

export const buildZkTxCarlSendNftToAlice = async (
  ctx: CtxProvider,
): Promise<ZkTx> => {
  const { wallets, accounts, tokens } = ctx()
  const carlWallet = wallets.carl
  const { carl } = accounts
  const { alice } = accounts
  const tokenAddr = tokens.erc721.address
  const carlPrevBalance = await carlWallet.getSpendableAmount(carl)
  const carlPrevNFTs = carlPrevBalance.getNFTs(tokenAddr)
  const carlSpendables: Utxo[] = await carlWallet.getSpendables(carl)
  const carlRawTx = TxBuilder.from(carl.zkAddress)
    .provide(...carlSpendables.map(note => Utxo.from(note)))
    .weiPerByte(toWei('100000', 'gwei'))
    .sendNFT({
      eth: Field.zero,
      tokenAddr,
      nft: carlPrevNFTs[0],
      to: alice.zkAddress,
    })
    .build()
  const carlZkTxal = await carlWallet.shieldTx({
    tx: carlRawTx,
    encryptTo: alice.zkAddress,
  })
  const carlNewNFTs = (await carlWallet.getSpendableAmount(carl)).getNFTs(
    tokenAddr,
  )
  const carlLockedNFTs = (await carlWallet.getLockedAmount(carl)).getNFTs(
    tokenAddr,
  )
  expect(
    [...carlLockedNFTs, ...carlNewNFTs].map(f => f.toString()).sort(),
  ).toStrictEqual(carlPrevNFTs.map(f => f.toString()).sort())
  return carlZkTxal
}

export const testRound1SendZkTxsToCoordinator = (
  ctx: CtxProvider,
  txs: () => {
    aliceTransfer: ZkTx
    bobTransfer: ZkTx
    carlTransfer: ZkTx
  },
) => async () => {
  const { wallets } = ctx()
  const { aliceTransfer, bobTransfer, carlTransfer } = txs()
  const [response1, response2, response3] = await Promise.all([
    wallets.alice.sendLayer2Tx(aliceTransfer),
    wallets.bob.sendLayer2Tx(bobTransfer),
    wallets.carl.sendLayer2Tx(carlTransfer),
  ])
  expect(response1.status).toStrictEqual(200)
  expect(response2.status).toStrictEqual(200)
  expect(response3.status).toStrictEqual(200)
}

export const testRound1NewBlockProposal = (
  ctx: CtxProvider,
  subCtx: () => { prevLatestBlock: Bytes32 },
) => async () => {
  const { wallets, coordinator } = ctx()
  const { prevLatestBlock } = subCtx()
  let updated = false
  let newBlockHash!: Bytes32
  do {
    const aliceLatestBlock = await wallets.alice.node.latestBlock()
    const bobLatestBlock = await wallets.bob.node.latestBlock()
    const carlLatestBlock = await wallets.carl.node.latestBlock()
    const coordinatorLatestBlock = await coordinator.node().latestBlock()
    if (
      aliceLatestBlock.eq(bobLatestBlock) &&
      aliceLatestBlock.eq(carlLatestBlock) &&
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
  expect(newBlock?.body.txs).toHaveLength(3)
}

export const testRound1NewSpendableUtxos = (ctx: CtxProvider) => async () => {
  const { wallets, tokens } = ctx()
  const aliceBalance = await wallets.alice.getSpendableAmount()
  const bobBalance = await wallets.bob.getSpendableAmount()
  const carlBalance = await wallets.carl.getSpendableAmount()
  expect(
    aliceBalance.erc721[tokens.erc721.address].find(nft => nft.eqn(1)),
  ).toBeDefined()
  expect(
    carlBalance.erc20[tokens.erc20.address].eq(toBN(toWei('1', 'ether'))),
  ).toBeTruthy()
  expect(
    bobBalance.erc20[tokens.erc20.address].eq(toBN(toWei('9', 'ether'))),
  ).toBeTruthy()
}
