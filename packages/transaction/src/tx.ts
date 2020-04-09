import { Hex } from 'web3-utils'
import { Field, F, Point } from '@zkopru/babyjubjub'
import { Output } from './output'
import { Spendable } from './spendable'

export interface RawTx {
  inflow: Output[]
  outflow: Output[]
  swap?: Field
  fee: Field
}

export class TxBuilder {
  spendables: Output[]

  sendings: Output[]

  txFee: Field

  swap?: Field

  changeTo: Point

  constructor(pubKey: Point) {
    this.spendables = []
    this.sendings = []
    this.changeTo = pubKey
    this.txFee = Field.zero
  }

  static from(pubKey: Point) {
    return new TxBuilder(pubKey)
  }

  fee(fee: F): TxBuilder {
    this.txFee = Field.from(fee)
    return this
  }

  spend(...utxos: Output[]): TxBuilder {
    utxos.forEach(utxo => this.spendables.push(utxo))
    return this
  }

  /**
   * This will throw underflow Errof when it does not have enough ETH for fee
   */
  spendable(): Spendable {
    const asset = Spendable.from(this.spendables)
    asset.eth = asset.eth.sub(this.txFee)
    return asset
  }

  sendEther({
    eth,
    to,
    withdrawal,
    migration,
  }: {
    eth: Hex | Field
    to: Point
    withdrawal?: {
      to: Hex
      fee: Hex | Field
    }
    migration?: {
      to: Hex
      fee: Hex | Field
    }
  }): TxBuilder {
    if (withdrawal && migration)
      throw Error(
        'You should have only one value of withdrawalTo or migrationTo',
      )
    const utxo = Output.newEtherNote({ eth, pubKey: to })
    if (withdrawal) {
      utxo.markAsWithdrawal(withdrawal)
    } else if (migration) {
      utxo.markAsMigration(migration)
    }
    this.sendings.push(utxo)
    return this
  }

  sendERC20({
    tokenAddr,
    erc20Amount,
    to,
    eth,
    withdrawal,
    migration,
  }: {
    tokenAddr: Hex | Field
    erc20Amount: Hex | Field
    to: Point
    eth?: Hex | Field
    withdrawal?: {
      to: Hex
      fee: Hex | Field
    }
    migration?: {
      to: Hex
      fee: Hex | Field
    }
  }): TxBuilder {
    const utxo = Output.newERC20Note({
      eth: eth || 0,
      tokenAddr,
      erc20Amount,
      pubKey: to,
    })
    if (withdrawal) {
      utxo.markAsWithdrawal(withdrawal)
    } else if (migration) {
      utxo.markAsMigration(migration)
    }
    this.sendings.push(utxo)
    return this
  }

  sendNFT({
    tokenAddr,
    nft,
    to,
    eth,
    withdrawal,
    migration,
  }: {
    tokenAddr: Hex | Field
    nft: Hex | Field
    to: Point
    eth?: Hex | Field
    withdrawal?: {
      to: Hex
      fee: Hex | Field
    }
    migration?: {
      to: Hex
      fee: Hex | Field
    }
  }): TxBuilder {
    const utxo = Output.newNFTNote({
      eth: eth || 0,
      tokenAddr,
      nft,
      pubKey: to,
    })
    if (withdrawal) {
      utxo.markAsWithdrawal(withdrawal)
    } else if (migration) {
      utxo.markAsMigration(migration)
    }
    this.sendings.push(utxo)
    return this
  }

  swapForEther(amount: Field): TxBuilder {
    this.swap = Output.newEtherNote({
      eth: amount,
      pubKey: this.changeTo,
    }).hash()
    return this
  }

  swapForERC20({
    tokenAddr,
    erc20Amount,
  }: {
    tokenAddr: Field
    erc20Amount: Field
  }): TxBuilder {
    this.swap = Output.newERC20Note({
      eth: 0,
      tokenAddr,
      erc20Amount,
      pubKey: this.changeTo,
    }).hash()
    return this
  }

  swapForNFT({
    tokenAddr,
    nft,
  }: {
    tokenAddr: Hex | Field
    nft: Hex | Field
  }): TxBuilder {
    this.swap = Output.newNFTNote({
      eth: 0,
      tokenAddr,
      nft,
      pubKey: this.changeTo,
    }).hash()
    return this
  }

  build(): RawTx {
    const spendables: Output[] = [...this.spendables]
    const spendings: Output[] = []
    const sendingAmount = Spendable.from(this.sendings)

    Object.keys(sendingAmount.erc20).forEach(addr => {
      const targetAmount: Field = sendingAmount.erc20[addr]
      const sameERC20UTXOs: Output[] = this.spendables
        .filter(utxo => utxo.tokenAddr.toHex() === addr)
        .sort((a, b) => (a.erc20Amount.gt(b.erc20Amount) ? 1 : -1))
      for (const utxo of sameERC20UTXOs) {
        if (targetAmount.gt(Spendable.from(spendings).erc20[addr])) {
          spendings.push(...spendables.splice(spendables.indexOf(utxo), 1))
        } else {
          break
        }
      }
      if (targetAmount.gt(Spendable.from(spendings).erc20[addr])) {
        throw Error(`Non enough ERC20 token ${addr} / ${targetAmount}`)
      }
    })

    Object.keys(sendingAmount.erc721).forEach(addr => {
      const sendingNFTs: Field[] = sendingAmount.erc721[addr].sort((a, b) =>
        a.gt(b) ? 1 : -1,
      )
      const spendingNFTNotes: Output[] = this.spendables.filter(utxo => {
        return (
          utxo.tokenAddr.toHex() === addr &&
          sendingNFTs.find(nft => nft.equal(utxo.nft)) !== undefined
        )
      })
      if (sendingNFTs.length !== spendingNFTNotes.length) {
        throw Error('Not enough NFTs')
      }
      spendingNFTNotes.sort((a, b) => (a.nft.gt(b.nft) ? 1 : -1))
      for (let i = 0; i < sendingNFTs.length; i += 1) {
        if (!sendingNFTs[i].equal(spendingNFTNotes[i].nft))
          throw Error('Failed to find the exact NFT')
      }
      for (const utxo of spendingNFTNotes) {
        spendings.push(...spendables.splice(spendables.indexOf(utxo), 1))
      }
    })

    const requiredETH = sendingAmount.eth.add(this.txFee)
    spendables.sort((a, b) => (a.eth.gt(b.eth) ? -1 : 1))
    while (requiredETH.gte(Spendable.from(spendings).eth)) {
      const spending = spendables.pop()
      if (spending === undefined) throw Error('Not enough Ether')
      spendings.push(spending)
    }

    const changes: Output[] = []
    const spendingAmount = Spendable.from(spendings)
    Object.keys(spendingAmount.erc20).forEach(addr => {
      const change = spendingAmount.erc20[addr].sub(sendingAmount.erc20[addr])
      if (!change.isZero()) {
        changes.push(
          Output.newERC20Note({
            eth: 0,
            tokenAddr: Field.from(addr),
            erc20Amount: change,
            pubKey: this.changeTo,
          }),
        )
      }
    })
    const extraNFTs: { [addr: string]: Field[] } = {}
    Object.keys(spendingAmount.erc721).forEach(addr => {
      extraNFTs[addr] = spendingAmount.erc721[addr].filter(nft => {
        if (sendingAmount.erc721[addr] === undefined) {
          return true
        }
        if (sendingAmount.erc721[addr].find(nft.equal) === undefined) {
          return true
        }
        return false
      })
    })
    Object.keys(extraNFTs).forEach(addr => {
      extraNFTs[addr].forEach(nft => {
        changes.push(
          Output.newNFTNote({
            eth: 0,
            tokenAddr: Field.from(addr),
            nft,
            pubKey: this.changeTo,
          }),
        )
      })
    })

    const changeETH = spendingAmount.eth.sub(sendingAmount.eth).sub(this.txFee)
    if (!changeETH.isZero()) {
      changes.push(
        Output.newEtherNote({ eth: changeETH, pubKey: this.changeTo }),
      )
    }

    const inflow = [...spendings]
    const outflow = [...this.sendings, ...changes]
    return {
      inflow,
      outflow,
      swap: this.swap,
      fee: this.txFee,
    }
  }
}
