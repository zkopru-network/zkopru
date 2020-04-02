import { UTXO } from './utxo'
import { Field } from './field'

export class Spendable {
  eth: Field

  erc20: { [addr: string]: Field }

  erc721: { [addr: string]: Field[] }

  constructor(
    eth: Field,
    erc20: { [addr: string]: Field },
    erc721: { [addr: string]: Field[] },
  ) {
    this.eth = eth
    this.erc20 = erc20
    this.erc721 = erc721
  }

  static etherFrom(utxos: UTXO[]): Field {
    let sum = Field.from(0)
    for (const item of utxos) {
      sum = sum.add(item.eth)
    }
    return sum
  }

  static erc20From(utxos: UTXO[]): { [addr: string]: Field } {
    const erc20: { [addr: string]: Field } = {}
    for (const item of utxos) {
      const addr = item.tokenAddr.toHex()
      if (!item.erc20Amount.isZero() && item.nft.isZero()) {
        const prev = erc20[addr] ? erc20[addr] : Field.from(0)
        erc20[addr] = prev.add(item.erc20Amount)
      }
    }
    return erc20
  }

  static nftsFrom(utxos: UTXO[]): { [addr: string]: Field[] } {
    const erc721: { [addr: string]: Field[] } = {}
    for (const item of utxos) {
      const addr = item.tokenAddr.toHex()
      if (item.erc20Amount.isZero() && !item.nft.isZero()) {
        if (!erc721[addr]) {
          erc721[addr] = []
        }
        erc721[addr].push(item.nft)
      }
    }
    return erc721
  }

  static from(utxos: UTXO[]): Spendable {
    return {
      eth: Spendable.etherFrom(utxos),
      erc20: Spendable.erc20From(utxos),
      erc721: Spendable.nftsFrom(utxos),
    }
  }
}
