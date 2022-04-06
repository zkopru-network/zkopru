import chai from 'chai'
import { TxBuilder, Utxo, ZkTx } from '~transaction'
import { Fp } from '~babyjubjub'
import { sleep } from '~utils'
import { Bytes32 } from 'soltypes'
import { parseUnits } from 'ethers/lib/utils'
import { CtxProvider } from '../context'

const { expect } = chai

export const buildZkTxAliceSendEthToBob = async (
  ctx: CtxProvider,
): Promise<ZkTx> => {
  const { wallets, accounts } = ctx()
  const aliceWallet = wallets.alice
  const { alice } = accounts
  const { bob } = accounts

  const alicePrevBalance = await aliceWallet.getSpendableAmount(alice)
  const aliceSpendables: Utxo[] = await aliceWallet.getSpendables(alice)
  const alicePrevLocked = await aliceWallet.getLockedAmount(alice)
  const aliceRawTx = TxBuilder.from(alice.zkAddress)
    .provide(...aliceSpendables.map(note => Utxo.from(note)))
    .weiPerByte(parseUnits('100000', 'gwei'))
    .sendEther({
      eth: Fp.from(parseUnits('1', 'ether')),
      to: bob.zkAddress,
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
  const bobPrevLocked = (await bobWallet.getLockedAmount(bob)).getERC20(
    tokenAddr,
  )
  const bobSpendables: Utxo[] = await bobWallet.getSpendables(bob)
  const bobRawTx = TxBuilder.from(bob.zkAddress)
    .provide(...bobSpendables.map(note => Utxo.from(note)))
    .weiPerByte(parseUnits('100000', 'gwei'))
    .sendERC20({
      eth: Fp.zero,
      tokenAddr,
      erc20Amount: Fp.from(parseUnits('1', 'ether')),
      to: carl.zkAddress,
    })
    .build()
  const bobZkTx = await bobWallet.shieldTx({
    tx: bobRawTx,
  })
  const bobNewBalance = (await bobWallet.getSpendableAmount(bob)).getERC20(
    tokenAddr,
  )
  const bobLockedAmount = (await bobWallet.getLockedAmount(bob)).getERC20(
    tokenAddr,
  )
  expect(bobNewBalance.add(bobLockedAmount)).to.eq(
    bobPrevBalance.add(bobPrevLocked),
  )
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
    .weiPerByte(parseUnits('100000', 'gwei'))
    .sendNFT({
      eth: Fp.zero,
      tokenAddr,
      nft: carlPrevNFTs[0],
      to: alice.zkAddress,
    })
    .build()
  const carlZkTxal = await carlWallet.shieldTx({
    tx: carlRawTx,
  })
  const carlNewNFTs = (await carlWallet.getSpendableAmount(carl)).getNFTs(
    tokenAddr,
  )
  const carlLockedNFTs = (await carlWallet.getLockedAmount(carl)).getNFTs(
    tokenAddr,
  )
  expect(
    JSON.stringify(
      [...carlLockedNFTs, ...carlNewNFTs].map(f => f.toString()).sort(),
    ),
  ).to.eq(JSON.stringify(carlPrevNFTs.map(f => f.toString()).sort()))
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
  const r = await wallets.alice.sendLayer2Tx([
    aliceTransfer,
    bobTransfer,
    carlTransfer,
  ])
  expect(r.status).to.eq(200)
}

export const testRound1NewBlockProposal = (
  ctx: CtxProvider,
  subCtx: () => { prevLatestBlock: Bytes32 },
) => async () => {
  const { wallets, coordinator, fixtureProvider } = ctx()
  const { prevLatestBlock } = subCtx()
  let updated = false
  let newBlockHash!: Bytes32
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

export const testRound1NewSpendableUtxos = (ctx: CtxProvider) => async () => {
  const { wallets, tokens } = ctx()
  const aliceBalance = await wallets.alice.getSpendableAmount()
  const bobBalance = await wallets.bob.getSpendableAmount()
  const carlBalance = await wallets.carl.getSpendableAmount()
  expect(aliceBalance.erc721[tokens.erc721.address].find(nft => nft.eq(1))).to
    .exist
  expect(carlBalance.erc20[tokens.erc20.address]).to.eq(
    parseUnits('1', 'ether'),
  )
  expect(bobBalance.erc20[tokens.erc20.address]).to.eq(parseUnits('9', 'ether'))
}
