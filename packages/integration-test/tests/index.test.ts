/**
 * @jest-environment node
 */
/* eslint-disable jest/no-disabled-tests */
/* eslint-disable jest/no-commented-out-tests */
/* eslint-disable jest/no-expect-resolves */
/* eslint-disable jest/require-tothrow-message */
/* eslint-disable @typescript-eslint/camelcase */
/* eslint-disable jest/no-hooks */
import { ZkTx } from '@zkopru/transaction'
import { Bytes32 } from 'soltypes'
import { Context, initContext, terminate } from './cases/context'
import {
  testAliceAccount,
  testCarlAccount,
  testBobAccount,
} from './cases/1_create_accounts'
import { testRegisterVKs, testRegisterVKFails } from './cases/2_register_vks'
import {
  testCompleteSetup,
  testRejectVkRegistration,
  registerCoordinator,
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
  jestExtendToCompareBigNumber,
  sleep,
  attachConsoleLogToPino,
} from '~utils'
import { attachConsoleErrorToPino } from '~utils/logger'
import {
  waitCoordinatorToProposeANewBlock,
  waitCoordinatorToProcessTheNewBlock,
  testBlockSync,
} from './cases/5_create_block'
import { GroveSnapshot } from '~tree/grove'
import {
  buildZkTxAliceSendEthToBob,
  buildZkTxBobSendERC20ToCarl as buildZkTxBobSendErc20ToCarl,
  buildZkTxCarlSendNftToAlice,
  testRound1SendZkTxsToCoordinator,
  testRound1NewBlockProposal,
  testRound1NewSpendableUtxos,
} from './cases/6_zk_tx_round_1'
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
  buildZkTxAliceSendEthToBob as round3Tx1,
  buildZkTxBobSendEthToCarl as round3Tx2,
  buildZkTxCarlSendEthToAlice as round3Tx3,
  testRound3SendZkTxsToCoordinator,
  testRound3NewBlockProposalAndSlashing,
} from './cases/9_zk_tx_round_3'

process.env.DEFAULT_COORDINATOR = 'http://localhost:8888'
process.env.BLOCK_CONFIRMATIONS = '0'

jestExtendToCompareBigNumber(expect)

describe('testnet', () => {
  // attachConsoleLogToPino()
  let context!: Context
  const ctx = () => context
  beforeAll(async () => {
    if (process.env.DEBUG) attachConsoleLogToPino()
    attachConsoleErrorToPino()
    context = await initContext()
  }, 90000)
  afterAll(async () => {
    console.log('terminating...')
    await terminate(ctx)
  }, 30000)
  describe('contract deployment', () => {
    it('should define zkopru address', () => {
      // eslint-disable-next-line jest/no-if
      const message = ctx().zkopruAddress
        ? 'Test environment is ready'
        : 'Try to adjust timeout or check docker status'
      console.log(message)
      expect(context.zkopruAddress).toBeDefined()
    })
  })
  describe('1: Zk Account', () => {
    it(
      'alice should have 100 ETH for her initial balance',
      testAliceAccount(ctx),
    )
    it('bob should have 100 ETH for his initial balance', testBobAccount(ctx))
    it('carl should have 100 ETH for his initial balance', testCarlAccount(ctx))
  })
  describe('2: Register verifying keys', () => {
    it('coordinator can register vks', testRegisterVKs(ctx), 30000)
    it('alice, bob, and carl cannot register vks', testRegisterVKFails(ctx))
  })
  describe('3: Complete setup', () => {
    // Wallets were initialized with empty vks because they were not registered on chain yet.
    // Therefore update the verifying keys after complete the setup process. This process is only needed in this integration test.
    afterAll(updateVerifyingKeys(ctx))
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
      it(
        'coordinator should have 5 pending deposits',
        testMassDeposits(ctx),
        30000,
      )
    })
  })
  describe('5: Coordinator create the first block', () => {
    let prevGroveSnapshot!: GroveSnapshot
    let newGroveSnapshot!: GroveSnapshot
    beforeAll(async () => {
      const { coordinator } = ctx()
      prevGroveSnapshot = await coordinator.layer2().grove.getSnapshot()
    })
    describe('register coordinator account', () => {
      // later it should be replaced with the burn auction
      it('should register "coordinator" account', registerCoordinator(ctx))
    })
    describe('coordinator creates the first block when the aggregated fee is enough', () => {
      afterAll(async () => {
        const { coordinator } = ctx()
        newGroveSnapshot = await coordinator.layer2().grove.getSnapshot()
      })
      it(
        'should propose a new block within a few seconds',
        waitCoordinatorToProposeANewBlock(ctx),
        30000,
      )
      it(
        'should process the new submitted block',
        waitCoordinatorToProcessTheNewBlock(ctx),
        90000,
      )
    })
    describe('new block should update trees', () => {
      it('should increase utxo index to at least 32(sub tree size)', () => {
        expect(
          prevGroveSnapshot.utxoTreeIndex.addn(32).toString(),
        ).toStrictEqual(newGroveSnapshot.utxoTreeIndex.toString())
      })
      it('should update the utxo root', () => {
        expect(prevGroveSnapshot.utxoTreeRoot.toString()).not.toStrictEqual(
          newGroveSnapshot.utxoTreeRoot.toString(),
        )
      })
    })
    describe('users subscribe Proposal() events', () => {
      it(
        'wallets should have updated processed block number',
        testBlockSync(ctx),
        60000,
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
      beforeAll(async () => {
        do {
          const latest = await context.coordinator.node().layer2.latestBlock()
          if (latest !== null) {
            prevLatestBlock = latest
            break
          }
          await sleep(1000)
        } while (!prevLatestBlock)
      }, 30000)
      it('create 3 transactions: alice transfer 1 Ether to Bob. Bob transfer 1 ERC20 to Carl, and Carl transfer 1 nft to Alice', async () => {
        aliceTransfer = await buildZkTxAliceSendEthToBob(ctx)
        bobTransfer = await buildZkTxBobSendErc20ToCarl(ctx)
        carlTransfer = await buildZkTxCarlSendNftToAlice(ctx)
      }, 300000)
      it(
        'they should send zk transactions to the coordinator',
        testRound1SendZkTxsToCoordinator(ctx, subCtx),
        60000,
      )
      it(
        'coordinator should propose a new block and wallet clients subscribe them',
        testRound1NewBlockProposal(ctx, subCtx),
        600000,
      )
      it(
        'wallets should have new spendable utxos as they sync the new block',
        testRound1NewSpendableUtxos(ctx),
        40000,
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
      beforeAll(async () => {
        do {
          const latest = await context.coordinator.node().layer2.latestBlock()
          if (latest !== null) {
            prevLatestBlock = latest
            break
          }
          await sleep(1000)
        } while (!prevLatestBlock)
      }, 30000)
      it('create 3 transactions: alice withdraw 1 NFT. Bob withdraw 1 ETH, and Carl withdraw 1 ERC20', async () => {
        aliceWithdrawal = await buildZkTxAliceWithrawNFT(ctx)
        bobWithdrawal = await buildZkTxBobWithdrawEth(ctx)
        carlWithdrawal = await buildZkTxCarlWithdrawErc20(ctx)
      }, 300000)
      it(
        'they should send zk transactions to the coordinator',
        testRound2SendZkTxsToCoordinator(ctx, subCtx),
        60000,
      )
      it(
        'coordinator should propose a new block and wallet clients subscribe them',
        testRound2NewBlockProposal(ctx, subCtx),
        600000,
      )
      it(
        'wallets should have new spendable utxos as they sync the new block',
        testRound2NewSpendableUtxos(ctx),
        40000,
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
      it(
        'should transfer 1 ETH to Bob',
        payForEthWithdrawalInAdvance(ctx),
        30000,
      )
    })
  })
  describe('9: Zk Transactions round 3', () => {
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
      beforeAll(async () => {
        do {
          const latest = await context.coordinator.node().layer2.latestBlock()
          if (latest !== null) {
            prevLatestBlock = latest
            break
          }
          await sleep(1000)
        } while (!prevLatestBlock)
      }, 30000)
      it('create 3 transactions: alice transfer 1 Ether to Bob. Bob transfer 1 Ether to Carl, and Carl transfer 1 Ether to Alice', async () => {
        aliceTransfer = await round3Tx1(ctx)
        bobTransfer = await round3Tx2(ctx)
        carlTransfer = await round3Tx3(ctx)
      }, 300000)
      it(
        'they should send zk transactions to the coordinator & coordinator creates an invalid block',
        testRound3SendZkTxsToCoordinator(ctx, subCtx),
        60000,
      )
      it(
        'coordinator proposes an invalid block and gets slashed',
        testRound3NewBlockProposalAndSlashing(ctx, subCtx),
        600000,
      )
    })
  })
  describe('10: Migration', () => {
    it.todo('please add test scenarios here')
  })
})
