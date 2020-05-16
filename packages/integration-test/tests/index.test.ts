/**
 * @jest-environment node
 */
/* eslint-disable jest/no-disabled-tests */
/* eslint-disable jest/no-commented-out-tests */
/* eslint-disable jest/no-expect-resolves */
/* eslint-disable jest/require-tothrow-message */
/* eslint-disable @typescript-eslint/camelcase */
/* eslint-disable jest/no-hooks */
import { Context, initContext, terminate } from './helper/context'
import {
  testAliceAccount,
  testCarlAccount,
  testBobAccount,
} from './helper/1_create_accounts'
import { testRegisterVKs, testRegisterVKFails } from './helper/2_register_vks'
import {
  testCompleteSetup,
  testRejectVkRegistration,
} from './helper/3_complete_setup'
import { depositEther, depositERC20, depositERC721 } from './helper/4_deposit'

describe('testnet', () => {
  let context!: Context
  const ctx = () => context
  beforeAll(async () => {
    context = await initContext()
  }, 15000)
  afterAll(async done => {
    await terminate(ctx)
    done()
  })
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
    it('coordinator can register vks', testRegisterVKs(ctx))
    it('alice, bob, and carl cannot register vks', testRegisterVKFails(ctx))
  })
  describe('3: Complete setup', () => {
    describe('3-1: before completeSetup() called', () => {
      it('should allow only the coordinator', testCompleteSetup(ctx))
    })
    describe('3-2: after completeSetup() called', () => {
      it('should reject every register txs', testRejectVkRegistration(ctx))
    })
  })
  describe.skip('4: Deposits', () => {
    describe('users deposit assets', () => {
      it('ether: Alice, Bob, and Carl deposits Ether', depositEther(ctx))
      it('erc20: Bob deposits ERC20', depositERC20(ctx))
      it('erc721: Carl deposits NFTs', depositERC721(ctx))
    })
    describe('coordinator subscribe Deposit() events', () => {
      it.todo('Coordinator should subscribe the deposit events')
    })
  })
  describe('5: Coordinator create the first block', () => {
    describe('coordinator creates the first block', () => {
      it.todo('should register coordinator')
      it.todo('should create a first block')
      it.todo('should update the utxo tree')
    })
    describe('users subscribe Proposal() events', () => {
      it.todo('light clients should subscribe new block proposal')
    })
  })
  describe('6: Zk Transactions round 1', () => {
    describe('users send zk txs to the coordinator', () => {
      it.todo('alice creates a zk tx to send Ether to Bob')
      it.todo('bob creates a zk tx to send ERC20 to carl')
      it.todo('carl creates a zk tx to send ERC721 to alice')
      it.todo('alice creates an invalid zk tx')
    })
    describe('coordinator creates the 2nd block including zk txs', () => {
      it.todo('should contain 3 valid txs')
      it.todo('should not include the invalid tx')
      it.todo('should update the utxo tree')
      it.todo('should update the nullifier tree')
    })
    describe('users subscribe Proposal() event and try to decrypt memos', () => {
      it.todo('bob should receive Ether')
      it.todo('carl should receive ERC20')
      it.todo('alice should receive ERC721')
    })
  })
  describe('6: Zk Transactions round 2', () => {
    describe('users send zk txs to the coordinator', () => {
      it.todo('alice creates a zk tx to send ERC721 to Bob')
      it.todo('carl creates a zk tx to send ERC20 to alice')
      it.todo('bob creates a zk tx to merge his utxos into 1 utxo')
    })
    describe('coordinator creates the 3rd block including zk txs', () => {
      it.todo('should contain 3 valid txs')
      it.todo('should not include the invalid tx')
      it.todo('should update the utxo tree')
      it.todo('should update the nullifier tree')
    })
    describe('users subscribe Proposal() event and try to decrypt memos', () => {
      it.todo('bob should receive ERC721')
      it.todo('alice should receive ERC20')
    })
  })
  describe('7: Withdrawal', () => {
    describe('users send zk txs to the coordinator', () => {
      it.todo('alice sends an ERC20 withdrawal tx to the coordinator')
      it.todo('bob sends an ERC721 withdrawal tx to the coordinator')
      it.todo('carl sends Ether withdrawal tx to the coordinator')
    })
    describe('coordinator creates the 4rd block including zk txs', () => {
      it.todo('should contain 3 valid txs')
      it.todo('should update the withdrawal tree root')
      it.todo('should update the utxo tree')
      it.todo('should update the nullifier tree')
      it.todo('should update the withdrawal tree')
    })
  })
  describe('8: Instant withdrawal', () => {
    describe('alice sends an instant withdrawal tx', () => {
      it.todo('should pay extra fee to the coordinator')
    })
    describe('coordinator provides upfront payment', () => {
      it.todo("should be paid from the coordinator's own account")
    })
    describe('alice gets ERC20s on the main network', () => {
      it.todo('should top up an empty account of Alice')
    })
  })
  describe('9: Finalization', () => {
    describe('coordinator calls finalize()', () => {
      it.todo('should update the latest block')
      it.todo('should give reward to the coordinator')
    })
    describe('users subscribe Finalization() and run withdraw()', () => {
      it.todo('bob gets ERC 721 on the main network')
      it.todo('carl gets ERC 721 on the main network')
      it.todo('alice fails the double-withdrawal')
      it.todo(
        'should pay back the upfront payment for alice to the coordinator',
      )
    })
  })
  describe('10: Challenge', () => {
    describe('fraud', () => {
      it.todo('coordinator creates an invalind utxo roll up')
    })
    describe('watchdog', () => {
      it.todo('alice catches the fraud and submit a challenge')
    })
    describe('slash', () => {
      it.todo('coordinator gets slashed and the block gets invalidated')
      it.todo('alice gets the challenge reward')
    })
    describe('revert', () => {
      it.todo('every clients should update the revert')
    })
  })
  describe('11: Migration', () => {
    it.todo('please add test scenarios here')
  })
})
