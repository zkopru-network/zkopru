import { Fp } from '@zkopru/babyjubjub'
import { BigNumberish } from 'ethers'
import { ZkAddress } from './zk-address'
import { Utxo } from './utxo'
import { TxBuilder } from './tx-builder'

export class SwapTxBuilder extends TxBuilder {
  static from(owner: ZkAddress): SwapTxBuilder {
    return new SwapTxBuilder(owner)
  }

  weiPerByte(val: BigNumberish): SwapTxBuilder {
    this.feePerByte = Fp.from(val)
    return this
  }

  provide(...utxos: Utxo[]): SwapTxBuilder {
    utxos.forEach(utxo => this.spendables.push(utxo))
    return this
  }

  sendEther({
    eth,
    to,
    salt,
  }: {
    eth: BigNumberish
    to: ZkAddress
    salt: BigNumberish
  }): SwapTxBuilder {
    const note = Utxo.newEtherNote({ eth, owner: to, salt })
    this.send(note)
    return this
  }

  sendERC20({
    tokenAddr,
    erc20Amount,
    to,
    salt,
  }: {
    tokenAddr: BigNumberish
    erc20Amount: BigNumberish
    to: ZkAddress
    salt: BigNumberish
  }): SwapTxBuilder {
    const note = Utxo.newERC20Note({
      eth: 0,
      tokenAddr,
      erc20Amount,
      owner: to,
      salt,
    })
    this.send(note)
    return this
  }

  sendNFT({
    tokenAddr,
    nft,
    to,
    salt,
  }: {
    tokenAddr: BigNumberish
    nft: BigNumberish
    to: ZkAddress
    salt: BigNumberish
  }): SwapTxBuilder {
    const note = Utxo.newNFTNote({
      eth: 0,
      tokenAddr,
      nft,
      owner: to,
      salt,
    })
    this.send(note)
    return this
  }

  receiveEther(amount: Fp, salt: BigNumberish): SwapTxBuilder {
    this.swap = Utxo.newEtherNote({
      eth: amount,
      owner: this.changeTo,
      salt,
    }).hash()
    return this
  }

  receiveERC20({
    tokenAddr,
    erc20Amount,
    salt,
  }: {
    tokenAddr: BigNumberish
    erc20Amount: BigNumberish
    salt: BigNumberish
  }): SwapTxBuilder {
    this.swap = Utxo.newERC20Note({
      eth: 0,
      tokenAddr,
      erc20Amount,
      owner: this.changeTo,
      salt,
    }).hash()
    return this
  }

  receiveNFT({
    tokenAddr,
    nft,
    salt,
  }: {
    tokenAddr: BigNumberish
    nft: BigNumberish
    salt: BigNumberish
  }): SwapTxBuilder {
    this.swap = Utxo.newNFTNote({
      eth: 0,
      tokenAddr,
      nft,
      owner: this.changeTo,
      salt,
    }).hash()
    return this
  }
}
