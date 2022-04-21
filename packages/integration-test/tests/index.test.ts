import chai from 'chai'
// import { BigNumber } from 'ethers'
// import { parseEther } from 'ethers/lib/utils'
// import { ethers } from 'hardhat'
import { Bytes32 } from 'soltypes'
import { Sum, ZkTx } from '~transaction'
import { GroveSnapshot } from '~tree/grove'
import { sleep } from '~utils'
import { Context, initContext, terminate } from './context'
import {
  testNewCoordinatorAccount,
  testAliceAccount,
  testCarlAccount,
  testBobAccount,
} from './cases/1_create_accounts'
import { testRegisterVKs, testRegisterVKFails } from './cases/2_register_vks'
import {
  testCompleteSetup,
  testRejectVkRegistration,
  updateVerifyingKeys,
  testRegisterTokens,
} from './cases/3_complete_setup'
import {
  depositEther,
  bobDepositsErc20,
  depositERC721,
  testMassDeposits,
} from './cases/4_deposit'
import {
  registerCoordinator,
  waitCoordinatorToProposeANewBlock,
  waitCoordinatorToProcessTheNewBlock,
  testBlockSync,
} from './cases/5_create_block'
import {
  buildZkTxAliceSendEthToBob,
  buildZkTxBobSendERC20ToCarl as buildZkTxBobSendErc20ToCarl,
  buildZkTxCarlSendNftToAlice,
  testRound1SendZkTxsToCoordinator,
  testRound1NewBlockProposal,
  testRound1NewSpendableUtxos,
} from './cases/6_zk_tx_round_1'
import {
  buildZkSwapTxAliceSendEthToBobAndReceiveERC20 as round4Tx1,
  buildZkSwapTxBobSendERC20ToAliceAndReceiveEther as round4Tx2,
  testRound4SendZkTxsToCoordinator,
  testRound4NewBlockProposal,
  testRound4NewSpendableUtxos,
} from './cases/6-2_zk_tx_round_1-2'
import {
  buildZkTxAliceWithrawNFT,
  buildZkTxBobWithdrawEth,
  buildZkTxCarlWithdrawErc20,
  testRound2NewBlockProposal,
  testRound2NewSpendableUtxos,
  testRound2SendZkTxsToCoordinator,
} from './cases/7_zk_tx_round_2'
import {
  testGetWithdrawablesOfAlice,
  testGetWithdrawablesOfBob,
  testGetWithdrawablesOfCarl,
  payForEthWithdrawalInAdvance,
} from './cases/8_instant_withdrawals'
import {
  aliceDepositEthers33Times,
  commitMassDeposit,
  waitCoordinatorToProcessTheNewBlockFor33Deposits,
  waitCoordinatorToProposeANewBlockFor33Deposits,
} from './cases/9_massive_deposits'
import {
  buildZkTxAliceSendEthToBob as round3Tx1,
  buildZkTxBobSendEthToCarl as round3Tx2,
  buildZkTxCarlSendEthToAlice as round3Tx3,
  testRound3SendZkTxsToCoordinator,
  testRound3NewBlockProposalAndSlashing,
} from './cases/10_zk_tx_round_3'

const { expect } = chai

describe('testnet', () => {
  let context!: Context
  const ctx = () => context
  before(async () => {
    context = await initContext()
  })
  after(async () => {
    console.log('terminating...')
    await terminate(ctx)
  })
  describe('contract deployment', () => {
    it('should define zkopru address', () => {
      // eslint-disable-next-line jest/no-if
      const message = ctx().zkopruAddress
        ? 'Test environment is ready'
        : 'Try to adjust timeout or check hardhat status'
      console.log(message)
    })
  })
  describe('1: Zk Account', () => {
    it(`newCoordinator should have 1000 ETH for its initial balance`, testNewCoordinatorAccount(ctx))
    it(
      'alice should have 1000 ETH for her initial balance',
      testAliceAccount(ctx),
    )
    it('bob should have 1000 ETH for his initial balance', testBobAccount(ctx))
    it('carl should have 1000 ETH for his initial balance', testCarlAccount(ctx))
  })
  describe('2: Register verifying keys', () => {
    it('coordinator can register vks', testRegisterVKs(ctx))
    it('alice, bob, and carl cannot register vks', testRegisterVKFails(ctx))
  })
  describe('3: Complete setup', () => {
    // Wallets were initialized with empty vks because they were not registered on chain yet.
    // Therefore update the verifying keys after complete the setup process. This process is only needed in this integration test.
    after(updateVerifyingKeys(ctx))
    describe('3-1: before completeSetup() called', () => {
      it('should allow only the coordinator', testCompleteSetup(ctx))
    })
    describe('3-2: after completeSetup() called', () => {
      it('should reject every register txs', testRejectVkRegistration(ctx))
    })
    describe('3-3: coordinator can register ERC20 or ERC721 tokens.', () => {
      it('should register sample erc20 and erc721', testRegisterTokens(ctx))
    })
  })
  describe('4: Deposits', () => {
    describe('4-1: users deposit assets', () => {
      it('ether: Alice, Bob, and Carl each deposit 10 ETH', depositEther(ctx))
      it('erc20: Bob deposits ERC20', bobDepositsErc20(ctx))

      it('erc721: Carl deposits NFTs', depositERC721(ctx))
    })
    describe('4-2: coordinator commits MassDeposit', () => {
      it('coordinator should have 5 pending deposits', testMassDeposits(ctx))
    })
  })
  describe('5: Coordinator create the first block', () => {
    let prevGroveSnapshot!: GroveSnapshot
    let newGroveSnapshot!: GroveSnapshot
    before(async () => {
      const { coordinator } = ctx()
      prevGroveSnapshot = await coordinator.layer2().grove.getSnapshot()
    })
    describe('register coordinator account', () => {
      // later it should be replaced with the burn auction
      it('should register "coordinator" account', registerCoordinator(ctx))
    })
    describe('coordinator creates the first block when the aggregated fee is enough', () => {
      after(async () => {
        const { coordinator } = ctx()
        newGroveSnapshot = await coordinator.layer2().grove.getSnapshot()
      })
      it(
        'should propose a new block within a few seconds',
        waitCoordinatorToProposeANewBlock(ctx),
      )
      it(
        'should process the new submitted block',
        waitCoordinatorToProcessTheNewBlock(ctx),
      )
    })
    describe('new block should update trees', () => {
      it('should increase utxo index to at least 32(sub tree size)', () => {
        expect(prevGroveSnapshot.utxoTreeIndex.add(32)).to.eq(
          newGroveSnapshot.utxoTreeIndex,
        )
      })
      it('should update the utxo root', () => {
        expect(prevGroveSnapshot.utxoTreeRoot).not.to.eq(
          newGroveSnapshot.utxoTreeRoot,
        )
      })
    })
    describe('users subscribe Proposal() events', () => {
      it(
        'wallets should have updated processed block number',
        testBlockSync(ctx),
      )
    })
  })
  describe('6: Zk Transactions round 1', () => {
    let aliceTransfer: ZkTx
    let bobTransfer: ZkTx
    let carlTransfer: ZkTx
    let prevLatestBlock: Bytes32
    const subCtx = () => ({
      aliceTransfer,
      bobTransfer,
      carlTransfer,
      prevLatestBlock,
    })
    describe('users send zk txs to the coordinator', () => {
      before(async () => {
        const { fixtureProvider } = ctx()
        do {
          const latest = await context.coordinator.node().layer2.latestBlock()
          if (latest !== null) {
            prevLatestBlock = latest
            break
          }
          await fixtureProvider.advanceBlock(8)
          await sleep(1000)
        } while (!prevLatestBlock)
      })
      it('create 3 transactions: alice transfer 1 Ether to Bob. Bob transfer 1 ERC20 to Carl, and Carl transfer 1 nft to Alice', async () => {
        aliceTransfer = await buildZkTxAliceSendEthToBob(ctx)
        bobTransfer = await buildZkTxBobSendErc20ToCarl(ctx)
        carlTransfer = await buildZkTxCarlSendNftToAlice(ctx)
      })
      it(
        'they should send zk transactions to the coordinator',
        testRound1SendZkTxsToCoordinator(ctx, subCtx),
      )
      it(
        'coordinator should propose a new block and wallet clients subscribe them',
        testRound1NewBlockProposal(ctx, subCtx),
      )
      it(
        'wallets should have new spendable utxos as they sync the new block',
        testRound1NewSpendableUtxos(ctx),
      )
    })
  })

  describe('6-2: Zk Transactions round 4 Swap', () => {
    let aliceSwap: ZkTx
    let bobSwap: ZkTx
    let aliceSpendablesBefore: Sum
    let bobSpendablesBefore: Sum
    let prevLatestBlock: Bytes32

    const subCtx = () => ({
      aliceSwap,
      aliceSpendablesBefore,
      bobSwap,
      bobSpendablesBefore,
      prevLatestBlock,
    })

    describe('users send swap zk txs to the coordinator', () => {
      before(async () => {
        const { fixtureProvider } = ctx()
        do {
          const latest = await context.coordinator.node().layer2.latestBlock()
          if (latest !== null) {
            prevLatestBlock = latest
            break
          }
          await fixtureProvider.advanceBlock(8)
          await sleep(1000)
        } while (!prevLatestBlock)

        aliceSpendablesBefore = await context.wallets.alice.getSpendableAmount()
        bobSpendablesBefore = await context.wallets.bob.getSpendableAmount()
      })

      it('create 2 transactions: alice and bob swap 1 Ether and 1 ERC20', async () => {
        aliceSwap = await round4Tx1(ctx)
        bobSwap = await round4Tx2(ctx)
      })

      it(
        'they should send zk transactions to the coordinator',
        testRound4SendZkTxsToCoordinator(ctx, subCtx),
      )
      console.log(`they complete`)
      it(
        'coordinator should propose a new block and wallet clients detect them',
        testRound4NewBlockProposal(ctx, subCtx),
      )

      it(
        'wallets should have new spendables as they sync new block',
        testRound4NewSpendableUtxos(ctx, subCtx),
      )
    })
  })

  describe('7: Zk Transactions round 2', () => {
    let aliceWithdrawal: ZkTx
    let bobWithdrawal: ZkTx
    let carlWithdrawal: ZkTx
    let prevLatestBlock: Bytes32
    const subCtx = () => ({
      aliceWithdrawal,
      bobWithdrawal,
      carlWithdrawal,
      prevLatestBlock,
    })
    describe('users withdraw their assets from the layer 2', () => {
      before(async () => {
        const { fixtureProvider } = ctx()
        do {
          const latest = await context.coordinator.node().layer2.latestBlock()
          if (latest !== null) {
            prevLatestBlock = latest
            break
          }
          await fixtureProvider.advanceBlock(8)
          await sleep(1000)
        } while (!prevLatestBlock)
      })
      it('create 3 transactions: alice withdraw 1 NFT. Bob withdraw 1 ETH, and Carl withdraw 1 ERC20', async () => {
        aliceWithdrawal = await buildZkTxAliceWithrawNFT(ctx)
        bobWithdrawal = await buildZkTxBobWithdrawEth(ctx)
        carlWithdrawal = await buildZkTxCarlWithdrawErc20(ctx)
      })
      it(
        'they should send zk transactions to the coordinator',
        testRound2SendZkTxsToCoordinator(ctx, subCtx),
      )
      it(
        'coordinator should propose a new block and wallet clients subscribe them',
        testRound2NewBlockProposal(ctx, subCtx),
      )
      it(
        'wallets should have new spendable utxos as they sync the new block',
        testRound2NewSpendableUtxos(ctx),
      )
    })
  })
  describe('8: Instant withdrawal', () => {
    describe('alice, bob, and carl has unfinalized withdrawable notes', () => {
      it(
        'alice has 1 unfinalized withdrawable note',
        testGetWithdrawablesOfAlice(ctx),
      )
      it(
        'bob has 1 unfinalized withdrawable note',
        testGetWithdrawablesOfBob(ctx),
      )
      it(
        'carl has 1 unfinalized withdrawable note',
        testGetWithdrawablesOfCarl(ctx),
      )
    })
    describe('coordinator prepays ETH for Bob', () => {
      it('should transfer 1 ETH to Bob', payForEthWithdrawalInAdvance(ctx))
    })
  })
  describe('9: Mass Tx', () => {
    it('alice deposit ether 33 times', aliceDepositEthers33Times(ctx))
    it(
      'commit mass deposit and wait for the block proposal',
      commitMassDeposit(ctx),
    )
    it(
      'wait coordinator propose a new block with 33 deposits',
      waitCoordinatorToProposeANewBlockFor33Deposits(ctx),
    )
    it(
      'wait coordinator process the block',
      waitCoordinatorToProcessTheNewBlockFor33Deposits(ctx),
    )
  })
  describe('10: Zk Transactions round 3', () => {
    let aliceTransfer: ZkTx
    let bobTransfer: ZkTx
    let carlTransfer: ZkTx
    const subCtx = () => ({
      aliceTransfer,
      bobTransfer,
      carlTransfer,
    })
    describe('users send zk txs to the coordinator', () => {
      it('create 3 transactions: alice transfer 1 Ether to Bob. Bob transfer 1 Ether to Carl, and Carl transfer 1 Ether to Alice', async () => {
        aliceTransfer = await round3Tx1(ctx)
        bobTransfer = await round3Tx2(ctx)
        carlTransfer = await round3Tx3(ctx)
      })
      it(
        'they should send zk transactions to the coordinator & coordinator creates an invalid block',
        testRound3SendZkTxsToCoordinator(ctx, subCtx),
      )
      it(
        'coordinator proposes an invalid block and gets slashed',
        testRound3NewBlockProposalAndSlashing(ctx),
      )
    })
  })
  describe('11: Migration', () => {
    it('please add test scenarios here')
  })
})
