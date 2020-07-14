import { Field, F, Point } from '@zkopru/babyjubjub'
import { Utxo } from './utxo'
import { TxBuilder } from './tx-builder'

export class SwapTxBuilder extends TxBuilder {
  static from(pubKey: Point): SwapTxBuilder {
    return new SwapTxBuilder(pubKey)
  }

  weiPerByte(val: F): SwapTxBuilder {
    this.feePerByte = Field.from(val)
    return this
  }

  provide(...utxos: Utxo[]): SwapTxBuilder {
    utxos.forEach(utxo => this.spendables.push(utxo))
    return this
  }

  sendEther({ eth, to, salt }: { eth: F; to: Point; salt: F }): SwapTxBuilder {
    const note = Utxo.newEtherNote({ eth, pubKey: to, salt })
    this.send(note)
    return this
  }

  sendERC20({
    tokenAddr,
    erc20Amount,
    to,
    salt,
  }: {
    tokenAddr: F
    erc20Amount: F
    to: Point
    salt: F
  }): SwapTxBuilder {
    const note = Utxo.newERC20Note({
      eth: 0,
      tokenAddr,
      erc20Amount,
      pubKey: to,
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
    tokenAddr: F
    nft: F
    to: Point
    salt: F
  }): SwapTxBuilder {
    const note = Utxo.newNFTNote({
      eth: 0,
      tokenAddr,
      nft,
      pubKey: to,
      salt,
    })
    this.send(note)
    return this
  }

  receiveEther(amount: Field, salt: F): SwapTxBuilder {
    this.swap = Utxo.newEtherNote({
      eth: amount,
      pubKey: this.changeTo,
      salt,
    }).hash()
    return this
  }

  receiveERC20({
    tokenAddr,
    erc20Amount,
    salt,
  }: {
    tokenAddr: F
    erc20Amount: F
    salt: F
  }): SwapTxBuilder {
    this.swap = Utxo.newERC20Note({
      eth: 0,
      tokenAddr,
      erc20Amount,
      pubKey: this.changeTo,
      salt,
    }).hash()
    return this
  }

  receiveNFT({
    tokenAddr,
    nft,
    salt,
  }: {
    tokenAddr: F
    nft: F
    salt: F
  }): SwapTxBuilder {
    this.swap = Utxo.newNFTNote({
      eth: 0,
      tokenAddr,
      nft,
      pubKey: this.changeTo,
      salt,
    }).hash()
    return this
  }
}
