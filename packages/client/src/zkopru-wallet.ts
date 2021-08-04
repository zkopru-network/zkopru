import { ZkWalletAccount } from '@zkopru/zk-wizard'
import { TxBuilder, RawTx, Utxo, ZkAddress } from '@zkopru/transaction'
import { Fp } from '@zkopru/babyjubjub'
import ZkopruNode from './zkopru-node'
import fetch from './fetch'

// The ipfs path for the latest proving keys
const DEFAULT_KEY_CID = '/ipfs/QmWdQnPVdbS61ERWJY76xfkbzrLDiQptE81LRTQUupSP7G'

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

  async loadCurrentPrice() {
    const activeUrl = await this.wallet.coordinatorManager.activeCoordinatorUrl()
    const r = await fetch(`${activeUrl}/price`)
    const { weiPerByte } = await r.json()
    return weiPerByte
  }

  async transactionsFor(zkAddress: string) {
    const sent = await this.wallet.db.findMany('Tx', {
      where: {
        senderAddress: zkAddress,
      },
      include: {
        proposal: true,
      },
    })
    const received = await this.wallet.db.findMany('Tx', {
      where: {
        receiverAddress: zkAddress,
      },
      include: {
        proposal: true,
      },
    })
    const deposits = await this.wallet.db.findMany('Deposit', {
      where: {
        ownerAddress: zkAddress,
      },
      include: {
        proposal: true,
      },
    })
    const withdrawals = await this.wallet.db.findMany('Withdrawal', {
      where: {
        owner: zkAddress,
      },
      include: {
        proposal: true,
      },
    })
    const pending = await this.wallet.db.findMany('PendingTx', {
      where: {
        senderAddress: zkAddress,
      },
    })
    return {
      pending,
      sent,
      received,
      deposits,
      withdrawals,
    }
  }
}
