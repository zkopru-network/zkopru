/* eslint-disable jest/no-truthy-falsy */
/* eslint-disable jest/no-expect-resolves */
/* eslint-disable jest/require-tothrow-message */
/* eslint-disable jest/no-export */
/* eslint-disable jest/require-top-level-describe */

import { toWei, toBN } from 'web3-utils'
import { TxBuilder, Utxo, ZkAddress, ZkTx } from '@zkopru/transaction'
import { Field } from '@zkopru/babyjubjub'
import { sleep } from '@zkopru/utils'
import { Bytes32 } from 'soltypes'
import { CtxProvider } from './context'

export const buildZkTxAliceWithrawNFT = async (
  ctx: CtxProvider,
): Promise<ZkTx> => {
  const { wallets, tokens, accounts } = ctx()
  const tokenAddr = tokens.erc721.address
  const aliceWallet = wallets.alice
  const { alice } = accounts

  const alicePrevBalance = await aliceWallet.getSpendableAmount(alice)
  const aliceSpendables: Utxo[] = await aliceWallet.getSpendables(alice)
  const alicePrevNFTs = alicePrevBalance.getNFTs(tokenAddr)
  const aliceRawTx = TxBuilder.from(alice.zkAddress)
    .provide(...aliceSpendables.map(note => Utxo.from(note)))
    .weiPerByte(toWei('100000', 'gwei'))
    .sendNFT({
      eth: Field.zero,
      tokenAddr,
      nft: alicePrevNFTs[0],
      to: ZkAddress.null,
      withdrawal: {
        to: Field.from(alice.ethAddress),
        fee: Field.zero, // NFT is not allowed for instant withdrawal
      },
    })
    .build()
  const aliceZkTx = await aliceWallet.shieldTx({
    tx: aliceRawTx,
  })
  const aliceNewNFTs = (await aliceWallet.getSpendableAmount(alice)).getNFTs(
    tokenAddr,
  )
  const aliceLockedNFTs = (await aliceWallet.getLockedAmount(alice)).getNFTs(
    tokenAddr,
  )
  expect(
    [...aliceLockedNFTs, ...aliceNewNFTs].map(f => f.toString()).sort(),
  ).toStrictEqual(alicePrevNFTs.map(f => f.toString()).sort())
  return aliceZkTx
}

export const buildZkTxBobWithdrawEth = async (
  ctx: CtxProvider,
): Promise<ZkTx> => {
  const { wallets, accounts } = ctx()
  const bobWallet = wallets.bob
  const { bob } = accounts
  const bobPrevBalance = (await bobWallet.getSpendableAmount(bob)).eth
  const bobSpendables: Utxo[] = await bobWallet.getSpendables(bob)
  const bobRawTx = TxBuilder.from(bob.zkAddress)
    .provide(...bobSpendables.map(note => Utxo.from(note)))
    .weiPerByte(toWei('100000', 'gwei'))
    .sendEther({
      eth: Field.from(toWei('1', 'ether')),
      to: ZkAddress.null,
      withdrawal: {
        to: Field.from(bob.ethAddress),
        fee: Field.from(toWei('100000', 'gwei')), // instant withdrawal fee
      },
    })
    .build()
  const bobWithdrawal = await bobWallet.shieldTx({
    tx: bobRawTx,
  })
  // const response = await bobWallet.sendTx(bobRawTx)
  const bobNewBalance = (await bobWallet.getSpendableAmount(bob)).eth
  const bobLockedAmount = (await bobWallet.getLockedAmount(bob)).eth
  // expect(response.status).toStrictEqual(200)
  expect(bobNewBalance.add(bobLockedAmount)).toBe(bobPrevBalance)
  return bobWithdrawal
}

export const buildZkTxCarlWithdrawErc20 = async (
  ctx: CtxProvider,
): Promise<ZkTx> => {
  const { wallets, accounts, tokens } = ctx()
  const carlWallet = wallets.carl
  const { carl } = accounts
  const tokenAddr = tokens.erc20.address
  const carlPrevBalance = (await carlWallet.getSpendableAmount(carl)).getERC20(
    tokenAddr,
  )
  const carlSpendables: Utxo[] = await carlWallet.getSpendables(carl)
  const carlRawTx = TxBuilder.from(carl.zkAddress)
    .provide(...carlSpendables.map(note => Utxo.from(note)))
    .weiPerByte(toWei('100000', 'gwei'))
    .sendERC20({
      eth: Field.zero,
      tokenAddr,
      erc20Amount: Field.from(toWei('1', 'ether')),
      to: ZkAddress.null,
      withdrawal: {
        to: Field.from(carl.ethAddress),
        fee: Field.from(toWei('100000', 'gwei')), // instant withdrawal fee
      },
    })
    .build()
  const carlWithdrawal = await carlWallet.shieldTx({
    tx: carlRawTx,
  })
  // const response = await bobWallet.sendTx(bobRawTx)
  const carlNewBalance = (await carlWallet.getSpendableAmount(carl)).getERC20(
    tokenAddr,
  )
  const carlLockedAmount = (await carlWallet.getLockedAmount(carl)).getERC20(
    tokenAddr,
  )
  // expect(response.status).toStrictEqual(200)
  expect(carlNewBalance.add(carlLockedAmount)).toBe(carlPrevBalance)
  return carlWithdrawal
}

export const testRound2SendZkTxsToCoordinator = (
  ctx: CtxProvider,
  txs: () => {
    aliceWithdrawal: ZkTx
    bobWithdrawal: ZkTx
    carlWithdrawal: ZkTx
  },
) => async () => {
  const { wallets } = ctx()
  const { aliceWithdrawal, bobWithdrawal, carlWithdrawal } = txs()
  const [response1, response2, response3] = await Promise.all([
    wallets.alice.sendLayer2Tx(aliceWithdrawal),
    wallets.bob.sendLayer2Tx(bobWithdrawal),
    wallets.carl.sendLayer2Tx(carlWithdrawal),
  ])
  expect(response1.status).toStrictEqual(200)
  expect(response2.status).toStrictEqual(200)
  expect(response3.status).toStrictEqual(200)
}

export const testRound2NewBlockProposal = (
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

export const testRound2NewSpendableUtxos = (ctx: CtxProvider) => async () => {
  const { wallets, tokens } = ctx()
  const aliceBalance = await wallets.alice.getSpendableAmount()
  const bobBalance = await wallets.bob.getSpendableAmount()
  const carlBalance = await wallets.carl.getSpendableAmount()
  expect(aliceBalance.erc721[tokens.erc721.address]).toBeUndefined()
  expect(bobBalance.eth.lt(toBN(toWei('10', 'ether')))).toBeTruthy()
  expect(carlBalance.erc20[tokens.erc20.address]).toBeUndefined()
}
