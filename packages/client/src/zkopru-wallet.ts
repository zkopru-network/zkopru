import { ZkWalletAccount } from '@zkopru/zk-wizard'
import {
  TxBuilder,
  RawTx,
  Utxo,
  ZkAddress,
  SwapTxBuilder,
  TokenRegistry,
} from '@zkopru/transaction'
import { Fp } from '@zkopru/babyjubjub'
import { BigNumberish } from 'ethers'
import { toChecksumAddress } from 'web3-utils'
import ZkopruNode from './zkopru-node'
import fetch from './fetch'

// The ipfs path for the latest proving keys
const DEFAULT_KEY_CID = '/ipfs/QmSQtbTnt5RWrP8uWJ3S5xUKntTx2DqcM7mM5vUg9uJGxq'
const ZERO_ADDRESS = '0x0000000000000000000000000000000000000000'

export default class ZkopruWallet {
  node: ZkopruNode

  wallet: ZkWalletAccount

  static async new(
    node: ZkopruNode,
    privateKey: Buffer | string,
  ): Promise<ZkopruWallet> {
    const wallet = new ZkopruWallet(node, privateKey)
    // wait until wallet account initialization finished
    await Promise.all(wallet.wallet.promises)
    return wallet
  }

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
    sendAmountOrId: string,
    receiveTokenAddress: string,
    receiveAmountOrId: string,
    weiPerByte: number | string,
    salt: BigNumberish,
  ): Promise<RawTx> {
    if (!this.wallet.account) {
      throw new Error('Account is not set')
    }
    const spendables = await this.wallet.getSpendables(this.wallet.account)
    const tokenRegistry = await this.node.node?.layer2.getTokenRegistry()
    const { erc20s, erc721s } = tokenRegistry as TokenRegistry

    let txBuilder = SwapTxBuilder.from(this.wallet.account.zkAddress)

    try {
      txBuilder = txBuilder
        .provide(...spendables.map(note => Utxo.from(note)))
        .weiPerByte(weiPerByte)

      if (sendTokenAddress === ZERO_ADDRESS) {
        // send ETH
        txBuilder = txBuilder.sendEther({
          eth: Fp.from(sendAmountOrId),
          to: new ZkAddress(to),
          salt,
        })
      } else if (
        erc20s.find(
          address =>
            address.toString().toLowerCase() === sendTokenAddress.toLowerCase(),
        )
      ) {
        // send erc20
        txBuilder = txBuilder.sendERC20({
          tokenAddr: sendTokenAddress,
          erc20Amount: sendAmountOrId,
          to: new ZkAddress(to),
          salt,
        })
      } else if (
        erc721s.find(
          address =>
            address.toString().toLowerCase() === sendTokenAddress.toLowerCase(),
        )
      ) {
        // send erc721
        txBuilder = txBuilder.sendNFT({
          tokenAddr: sendTokenAddress,
          nft: sendAmountOrId,
          to: new ZkAddress(to),
          salt,
        })
      } else {
        throw new Error(
          `Cannot find the sending token address "${sendTokenAddress}" in the token registry`,
        )
      }

      if (receiveTokenAddress === ZERO_ADDRESS) {
        // receive ETH
        txBuilder = txBuilder.receiveEther(Fp.from(receiveAmountOrId), salt)
      } else if (
        erc20s.find(
          address =>
            address.toString().toLowerCase() ===
            receiveTokenAddress.toLowerCase(),
        )
      ) {
        // receive ERC20
        txBuilder = txBuilder.receiveERC20({
          tokenAddr: receiveTokenAddress,
          erc20Amount: receiveAmountOrId,
          salt,
        })
      } else if (
        erc721s.find(
          address =>
            address.toString().toLowerCase() ===
            receiveTokenAddress.toLowerCase(),
        )
      ) {
        // receive ERC20
        txBuilder = txBuilder.receiveNFT({
          tokenAddr: receiveTokenAddress,
          nft: receiveAmountOrId,
          salt,
        })
      } else {
        throw new Error(
          `Cannot find the receiving token address "${receiveTokenAddress}" in the token registry`,
        )
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

  async calculateWeiPerByte() {
    const currentGasPrice = await this.wallet.node.layer1.provider.getGasPrice()
    const gasPerNonZero = 16
    // let's assume all of the bytes are non-zero
    // it's hard to look at an actual tx because the fee is encoded
    return Fp.from(currentGasPrice).mul(Fp.from(gasPerNonZero))
  }

  async transactionsFor(zkAddress: string, ethAddress: string) {
    const sent = await this.wallet.db.findMany('Tx', {
      where: {
        senderAddress: zkAddress,
        receiverAddress: null,
      },
      include: {
        proposal: { header: true },
      },
    })
    const received = await this.wallet.db.findMany('Tx', {
      where: {
        receiverAddress: zkAddress,
        senderAddress: null,
      },
      include: {
        proposal: { header: true },
      },
    })
    const self = await this.wallet.db.findMany('Tx', {
      where: {
        receiverAddress: zkAddress,
        senderAddress: zkAddress,
      },
      include: {
        proposal: { header: true },
      },
    })
    const allDeposits = await this.wallet.db.findMany('Deposit', {
      where: {
        ownerAddress: zkAddress,
      },
      include: {
        proposal: { header: true },
        utxo: true,
      },
    })
    const completeDeposits = allDeposits.filter(d => !!d.includedIn)
    const incompleteDeposits = allDeposits.filter(d => !d.includedIn)
    const pendingDeposits = await this.wallet.db.findMany('PendingDeposit', {
      where: {},
      include: { utxo: true },
    })
    const allWithdrawals = await this.wallet.db.findMany('Withdrawal', {
      where: {
        to: toChecksumAddress(ethAddress),
      },
      include: {
        proposal: { header: true },
      },
    })
    const withdrawals = allWithdrawals.filter(w => !!w.includedIn)
    const incompleteWithdrawals = allWithdrawals.filter(w => !w.includedIn)
    const pending = await this.wallet.db.findMany('PendingTx', {
      where: {
        senderAddress: zkAddress,
      },
    })
    return {
      pending: [
        ...pending.map(obj => Object.assign(obj, { type: 'PendingSend' })),
        ...pendingDeposits.map(obj =>
          Object.assign(obj, { type: 'PendingDeposit', ...obj.utxo }),
        ),
        ...incompleteDeposits.map(obj =>
          Object.assign(obj, { type: 'Deposit', ...obj.utxo }),
        ),
        ...incompleteWithdrawals.map(obj =>
          Object.assign(obj, { type: 'Withdraw' }),
        ),
      ],
      history: [
        ...self.map(obj => Object.assign(obj, { type: 'Self' })),
        ...sent.map(obj => Object.assign(obj, { type: 'Send' })),
        ...received.map(obj => Object.assign(obj, { type: 'Receive' })),
        ...completeDeposits.map(obj =>
          Object.assign(obj, { type: 'Deposit', ...obj.utxo }),
        ),
        ...withdrawals.map(obj => Object.assign(obj, { type: 'Withdraw' })),
      ],
    }
  }
}
