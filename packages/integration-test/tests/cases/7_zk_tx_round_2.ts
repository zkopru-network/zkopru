import chai from 'chai'
import { TxBuilder, Utxo, ZkAddress, ZkTx } from '~transaction'
import { Fp } from '~babyjubjub'
import { sleep } from '~utils'
import { parseUnits } from 'ethers/lib/utils'
import { Bytes32 } from 'soltypes'
import { CtxProvider } from '../context'

const { expect } = chai

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
    .weiPerByte(parseUnits('100000', 'gwei'))
    .sendNFT({
      eth: Fp.zero,
      tokenAddr,
      nft: alicePrevNFTs[0],
      to: ZkAddress.null,
      withdrawal: {
        to: Fp.from(alice.ethAddress),
        fee: Fp.zero, // NFT is not allowed for instant withdrawal
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
  const newNFTs = [...aliceLockedNFTs, ...aliceNewNFTs]
    .map(f => f.toString())
    .sort()
  const prevNFTs = alicePrevNFTs.map(f => f.toString()).sort()
  newNFTs.forEach((nft, i) => expect(nft).eq(prevNFTs[i]))
  return aliceZkTx
}

export const buildZkTxBobWithdrawEth = async (
  ctx: CtxProvider,
): Promise<ZkTx> => {
  const { wallets, accounts } = ctx()
  const bobWallet = wallets.bob
  const { bob } = accounts
  const bobPrevBalance = (await bobWallet.getSpendableAmount(bob)).eth
  const bobPrevLocked = await bobWallet.getLockedAmount(bob)
  const bobSpendables: Utxo[] = await bobWallet.getSpendables(bob)
  const bobRawTx = TxBuilder.from(bob.zkAddress)
    .provide(...bobSpendables.map(note => Utxo.from(note)))
    .weiPerByte(parseUnits('100000', 'gwei'))
    .sendEther({
      eth: Fp.from(parseUnits('1', 'ether')),
      to: ZkAddress.null,
      withdrawal: {
        to: Fp.from(bob.ethAddress),
        fee: Fp.from(parseUnits('100000', 'gwei')), // instant withdrawal fee
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
  expect(bobNewBalance.add(bobLockedAmount)).to.eq(
    bobPrevBalance.add(bobPrevLocked.eth),
  )
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
  const carlPrevLocked = (await carlWallet.getLockedAmount(carl)).getERC20(
    tokenAddr,
  )
  const carlSpendables: Utxo[] = await carlWallet.getSpendables(carl)
  const carlRawTx = TxBuilder.from(carl.zkAddress)
    .provide(...carlSpendables.map(note => Utxo.from(note)))
    .weiPerByte(parseUnits('100000', 'gwei'))
    .sendERC20({
      eth: Fp.zero,
      tokenAddr,
      erc20Amount: Fp.from(parseUnits('1', 'ether')),
      to: ZkAddress.null,
      withdrawal: {
        to: Fp.from(carl.ethAddress),
        fee: Fp.from(parseUnits('100000', 'gwei')), // instant withdrawal fee
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
  expect(carlNewBalance.add(carlLockedAmount)).to.eq(
    carlPrevBalance.add(carlPrevLocked),
  )
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
  const { wallets, coordinator } = ctx()
  coordinator.middlewares.proposer.setPreProcessor(_ => undefined)
  const { aliceWithdrawal, bobWithdrawal, carlWithdrawal } = txs()
  const [response1, response2, response3] = await Promise.all([
    wallets.alice.sendLayer2Tx(aliceWithdrawal),
    wallets.bob.sendLayer2Tx(bobWithdrawal),
    wallets.carl.sendLayer2Tx(carlWithdrawal),
  ])
  expect(response1.status).to.eq(200)
  expect(response2.status).to.eq(200)
  expect(response3.status).to.eq(200)
}

export const testRound2NewBlockProposal = (
  ctx: CtxProvider,
  subCtx: () => { prevLatestBlock: Bytes32 },
) => async () => {
  const { wallets, coordinator, fixtureProvider } = ctx()
  const { prevLatestBlock } = subCtx()
  let updated = false
  let newBlockHash!: Bytes32
  coordinator.middlewares.proposer.removePreProcessor()
  do {
    const aliceLatestBlock = await wallets.alice.node.layer2.latestBlock()
    const bobLatestBlock = await wallets.bob.node.layer2.latestBlock()
    const carlLatestBlock = await wallets.carl.node.layer2.latestBlock()
    const coordinatorLatestBlock = await coordinator.node().layer2.latestBlock()
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
    await fixtureProvider.advanceBlock(8)
    await sleep(1000)
  } while (!updated)
  const newBlock = await wallets.alice.node.layer2.getBlock(newBlockHash)
  expect(newBlock?.body.txs).to.have.length(3)
}

export const testRound2NewSpendableUtxos = (ctx: CtxProvider) => async () => {
  const { wallets, tokens } = ctx()
  const aliceBalance = await wallets.alice.getSpendableAmount()
  const bobBalance = await wallets.bob.getSpendableAmount()
  const carlBalance = await wallets.carl.getSpendableAmount()
  expect(aliceBalance.erc721[tokens.erc721.address]).to.be.undefined
  expect(bobBalance.eth.lt(parseUnits('11', 'ether'))).to.be.true
  expect(carlBalance.erc20[tokens.erc20.address]).to.be.undefined
}
