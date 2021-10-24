import { ZkWalletAccount } from '@zkopru/zk-wizard'
import {
  TxBuilder,
  RawTx,
  Utxo,
  ZkAddress,
  SwapTxBuilder,
} from '@zkopru/transaction'
import { Fp, F } from '@zkopru/babyjubjub'
import ZkopruNode from './zkopru-node'
import fetch from './fetch'

// The ipfs path for the latest proving keys
const DEFAULT_KEY_CID = '/ipfs/QmWdQnPVdbS61ERWJY76xfkbzrLDiQptE81LRTQUupSP7G'
const ZERO_ADDRESS = '0x0000000000000000000000000000000000000000'

export default class ZkopruWallet {
  node: ZkopruNode

  wallet: ZkWalletAccount

  constructor(node: ZkopruNode, privateKey: Buffer | string) {
    this.node = node
    if (!this.node.node) {
      throw new Error('ZkopruNode does not have a full node initialized')
    }
    this.wallet = new ZkWalletAccount({
      privateKey,
      node: this.node.node,
      snarkKeyCid: DEFAULT_KEY_CID,
      // TODO: pre-written list or retrieve from remote
      erc20: [],
      erc721: [],
    })
  }

  async generateEtherTransfer(
    to: string,
    amountWei: string,
    weiPerByte: number | string,
  ): Promise<RawTx> {
    if (!this.wallet.account) {
      throw new Error('Account is not set')
    }
    const spendables = await this.wallet.getSpendables(this.wallet.account)
    const txBuilder = TxBuilder.from(this.wallet.account.zkAddress)
    try {
      return txBuilder
        .provide(...spendables.map(note => Utxo.from(note)))
        .weiPerByte(weiPerByte)
        .sendEther({
          eth: Fp.from(amountWei),
          to: new ZkAddress(to),
        })
        .build()
    } catch (err) {
      console.log(err)
      throw err
    }
  }

  async generateTokenTransfer(
    to: string,
    erc20Amount: string,
    tokenAddr: string,
    weiPerByte: number | string,
  ): Promise<RawTx> {
    if (!this.wallet.account) {
      throw new Error('Account is not set')
    }
    const spendables = await this.wallet.getSpendables(this.wallet.account)
    const txBuilder = TxBuilder.from(this.wallet.account.zkAddress)
    try {
      return txBuilder
        .provide(...spendables.map(note => Utxo.from(note)))
        .weiPerByte(weiPerByte)
        .sendERC20({
          erc20Amount: Fp.from(erc20Amount),
          tokenAddr,
          to: new ZkAddress(to),
        })
        .build()
    } catch (err) {
      console.log(err)
      throw err
    }
  }

  async generateWithdrawal(
    to: string,
    amountWei: string,
    weiPerByte: number | string,
    prepayFeeWei: string,
  ): Promise<RawTx> {
    if (!this.wallet.account) {
      throw new Error('Account is not set')
    }
    const spendables = await this.wallet.getSpendables(this.wallet.account)
    // const spendableAmount = Sum.from(spendables)
    const txBuilder = TxBuilder.from(this.wallet.account.zkAddress)
    try {
      return txBuilder
        .provide(...spendables.map(note => Utxo.from(note)))
        .weiPerByte(weiPerByte)
        .sendEther({
          eth: Fp.from(amountWei),
          to: ZkAddress.null,
          withdrawal: {
            to: Fp.from(to),
            fee: Fp.from(prepayFeeWei),
          },
        })
        .build()
    } catch (err) {
      console.log(err)
      throw err
    }
  }

  async generateTokenWithdrawal(
    to: string,
    erc20Amount: string,
    tokenAddr: string,
    weiPerByte: number | string,
    prepayFeeWei: string,
  ) {
    if (!this.wallet.account) {
      throw new Error('Account is not set')
    }
    const spendables = await this.wallet.getSpendables(this.wallet.account)
    // const spendableAmount = Sum.from(spendables)
    const txBuilder = TxBuilder.from(this.wallet.account.zkAddress)
    try {
      return txBuilder
        .provide(...spendables.map(note => Utxo.from(note)))
        .weiPerByte(weiPerByte)
        .sendERC20({
          tokenAddr,
          erc20Amount: Fp.from(erc20Amount),
          to: ZkAddress.null,
          withdrawal: {
            to: Fp.from(to),
            fee: Fp.from(prepayFeeWei),
          },
        })
        .build()
    } catch (err) {
      console.log(err)
      throw err
    }
  }

  async generateSwapTransaction(
    to: string,
    sendTokenAddress: string,
    sendAmount: string,
    receiveTokenAddress: string,
    receiveAmount: string,
    weiPerByte: number | string,
    salt: F,
  ): Promise<RawTx> {
    if (!this.wallet.account) {
      throw new Error('Account is not set')
    }
    const spendables = await this.wallet.getSpendables(this.wallet.account)
    let txBuilder = SwapTxBuilder.from(this.wallet.account.zkAddress)

    try {
      txBuilder = txBuilder
        .provide(...spendables.map(note => Utxo.from(note)))
        .weiPerByte(weiPerByte)
      if (sendTokenAddress === ZERO_ADDRESS) {
        // send ETH receive ERC20
        txBuilder = txBuilder
          .sendEther({
            eth: Fp.from(sendAmount),
            to: new ZkAddress(to),
            salt,
          })
          .receiveERC20({
            tokenAddr: receiveTokenAddress,
            erc20Amount: receiveAmount,
            salt,
          })
      } else if (receiveTokenAddress === ZERO_ADDRESS) {
        // send ERC20 receive ETH
        txBuilder = txBuilder
          .sendERC20({
            tokenAddr: sendTokenAddress,
            erc20Amount: sendAmount,
            to: new ZkAddress(to),
            salt,
          })
          .receiveEther(Fp.from(receiveAmount), salt)
      } else {
        // send ERC20 receive ERC20
        txBuilder = txBuilder
          .sendERC20({
            tokenAddr: sendTokenAddress,
            erc20Amount: sendAmount,
            to: new ZkAddress(to),
            salt,
          })
          .receiveERC20({
            tokenAddr: receiveTokenAddress,
            erc20Amount: receiveAmount,
            salt,
          })
      }

      return txBuilder.build()
    } catch (err) {
      console.log(err)
      throw err
    }
  }

  async loadCurrentPrice() {
    const activeUrl = await this.wallet.coordinatorManager.activeCoordinatorUrl()
    const r = await fetch(`${activeUrl}/price`)
    const { weiPerByte } = await r.json()
    return weiPerByte
  }

  async transactionsFor(zkAddress: string, ethAddress: string) {
    const sent = await this.wallet.db.findMany('Tx', {
      where: {
        senderAddress: zkAddress,
      },
      include: {
        proposal: { header: true },
      },
    })
    const received = await this.wallet.db.findMany('Tx', {
      where: {
        receiverAddress: zkAddress,
      },
      include: {
        proposal: { header: true },
      },
    })
    const completeDeposits = await this.wallet.db.findMany('Deposit', {
      where: {
        ownerAddress: zkAddress,
        includedIn: { neq: null },
      },
      include: {
        proposal: { header: true },
        utxo: true,
      },
    })
    const incompleteDeposits = await this.wallet.db.findMany('Deposit', {
      where: {
        ownerAddress: zkAddress,
        includedIn: { eq: null },
      },
      include: {
        proposal: { header: true },
        utxo: true,
      },
    })
    const withdrawals = await this.wallet.db.findMany('Withdrawal', {
      where: {
        to: this.node.node?.layer1.web3.utils.toChecksumAddress(ethAddress),
      },
      include: {
        proposal: { header: true },
      },
    })
    const pending = await this.wallet.db.findMany('PendingTx', {
      where: {
        senderAddress: zkAddress,
      },
    })
    return {
      pending: [
        ...pending.map(obj => Object.assign(obj, { type: 'Send' })),
        ...incompleteDeposits.map(obj =>
          Object.assign(obj, { type: 'Deposit', ...obj.utxo }),
        ),
      ],
      history: [
        ...sent.map(obj => Object.assign(obj, { type: 'Send' })),
        ...received.map(obj => Object.assign(obj, { type: 'Receive' })),
        ...completeDeposits
          .filter(deposit => !!deposit.proposal)
          .map(obj => Object.assign(obj, { type: 'Deposit', ...obj.utxo })),
        ...withdrawals.map(obj => Object.assign(obj, { type: 'Withdraw' })),
      ],
    }
  }
}
