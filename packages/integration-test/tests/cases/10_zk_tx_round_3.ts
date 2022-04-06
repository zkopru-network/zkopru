import chai from 'chai'
import { TxBuilder, Utxo, ZkTx } from '~transaction'
import { Fp } from '~babyjubjub'
import { sleep } from '~utils'
import { parseUnits } from 'ethers/lib/utils'
import { Uint256 } from 'soltypes'
import { Block } from '~core'
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
  const alicePrevLocked = await aliceWallet.getLockedAmount(alice)
  const aliceSpendables: Utxo[] = await aliceWallet.getSpendables(alice)
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
    .weiPerByte(parseUnits('100000', 'gwei'))
    .sendEther({
      eth: Fp.from(parseUnits('1', 'ether')),
      to: carl.zkAddress,
    })
    .build()
  const bobZkTx = await bobWallet.shieldTx({
    tx: bobRawTx,
  })
  const bobNewBalance = await bobWallet.getSpendableAmount(bob)
  const bobLockedAmount = await bobWallet.getLockedAmount(bob)
  expect(bobNewBalance.eth.add(bobLockedAmount.eth)).to.eq(
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
  const carlPrevLocked = await carlWallet.getLockedAmount(carl)
  const carlSpendables: Utxo[] = await carlWallet.getSpendables(carl)
  const carlRawTx = TxBuilder.from(carl.zkAddress)
    .provide(...carlSpendables.map(note => Utxo.from(note)))
    .weiPerByte(parseUnits('100000', 'gwei'))
    .sendEther({
      eth: Fp.from(parseUnits('1', 'ether')),
      to: alice.zkAddress,
    })
    .build()
  const carlZkTx = await carlWallet.shieldTx({
    tx: carlRawTx,
  })
  const carlNewBalance = await carlWallet.getSpendableAmount(carl)
  const carlLockedAmount = await carlWallet.getLockedAmount(carl)
  expect(carlNewBalance.eth.add(carlLockedAmount.eth)).to.eq(
    carlPrevBalance.eth.add(carlPrevLocked.eth),
  )
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
  const { wallets, coordinator } = ctx()
  coordinator.middlewares.proposer.setPreProcessor(_ => undefined)
  const { aliceTransfer, bobTransfer, carlTransfer } = txs()
  const r = await wallets.alice.sendLayer2Tx([
    aliceTransfer,
    bobTransfer,
    carlTransfer,
  ])
  expect(r.status).to.eq(200)
}

export const testRound3NewBlockProposalAndSlashing = (
  ctx: CtxProvider,
) => async () => {
  const { wallets, coordinator, fixtureProvider } = ctx()
  const prevLatestBlock = await coordinator.layer2().latestBlock()
  // prepare deposits more than 32
  let count = 0
  while (count < 33) {
    try {
      const result = await wallets.alice.depositEther(
        parseUnits('0.1', 'ether'),
        parseUnits('0.001', 'ether'),
      )
      if (result) count += 1
    } catch {
      await fixtureProvider.advanceBlock(8)
      await sleep(1000)
    }
  }
  // commit the mass deposit
  await coordinator.commitMassDeposits()
  let slashed = !(await coordinator.context.node.layer1.zkopru.isProposable(
    await coordinator.context.account.getAddress(),
  ))
  const latestBlock = await coordinator.layer2().latestBlock()
  const currentUtxoIndex = (await coordinator.layer2().getBlock(latestBlock))
    ?.header.utxoIndex
  coordinator.middlewares.proposer.setPreProcessor(block => {
    const numOfNewUtxos = block.header.utxoIndex
      .toBigNumber()
      .sub(currentUtxoIndex?.toBigNumber() || 0)
    if (numOfNewUtxos.gt(32)) {
      const cloned = Block.from(block.serializeBlock())
      cloned.header.utxoRoot = Uint256.from(
        block.header.utxoRoot
          .toBigNumber()
          .add(1)
          .toString(),
      )
      return cloned
    }
    return undefined
  })
  let wait = 600000
  do {
    slashed = !(await coordinator.context.node.layer1.zkopru.isProposable(
      await coordinator.context.account.getAddress(),
    ))
    await fixtureProvider.advanceBlock(8)
    await sleep(1000)
    wait -= 1000
  } while (!slashed && wait > 0)
  // Should be slashed
  const aliceLatestBlock = await wallets.alice.node.layer2.latestBlock()
  const bobLatestBlock = await wallets.bob.node.layer2.latestBlock()
  const carlLatestBlock = await wallets.carl.node.layer2.latestBlock()
  const coordinatorLatestBlock = await coordinator.node().layer2.latestBlock()
  // Nodes should throw away the slashed block
  expect(slashed).to.be.true
  expect(aliceLatestBlock.eq(prevLatestBlock)).to.be.true
  expect(bobLatestBlock.eq(prevLatestBlock)).to.be.true
  expect(carlLatestBlock.eq(prevLatestBlock)).to.be.true
  expect(coordinatorLatestBlock.eq(prevLatestBlock)).to.be.true
  coordinator.middlewares.proposer.removePreProcessor()
}
