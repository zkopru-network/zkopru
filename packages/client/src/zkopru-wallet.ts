import { ZkWalletAccount } from '@zkopru/zk-wizard'
import { TxBuilder, RawTx, Utxo, ZkAddress } from '@zkopru/transaction'
import { Fp } from '@zkopru/babyjubjub'
import ZkopruNode from './zkopru-node'

// The ipfs path for the latest proving keys
const DEFAULT_KEY_CID = '/ipfs/QmWdQnPVdbS61ERWJY76xfkbzrLDiQptE81LRTQUupSP7G'

export default class ZkopruWallet {
  node: ZkopruNode

  wallet: ZkWalletAccount

  constructor(
    node: ZkopruNode,
    privateKey: Buffer | string,
    coordinator: string,
  ) {
    this.node = node
    if (!this.node.node) {
      throw new Error('ZkopruNode does not have a full node initialized')
    }
    this.wallet = new ZkWalletAccount({
      privateKey,
      node: this.node.node,
      snarkKeyCid: DEFAULT_KEY_CID,
      coordinator,
      // TODO: pre-written list or retrieve from remote
      erc20: [],
      erc721: [],
    })
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
}
