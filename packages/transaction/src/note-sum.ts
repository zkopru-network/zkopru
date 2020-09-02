import { Field } from '@zkopru/babyjubjub'
import { Address } from 'soltypes'
import { Note } from './note'

export class Sum {
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

  getERC20(address: Address | string): Field {
    const addr = typeof address === 'string' ? Address.from(address) : address
    const amount = this.erc20[addr.toString().toLowerCase()] || Field.zero
    return amount
  }

  getNFTs(address: Address | string): Field[] {
    const addr = typeof address === 'string' ? Address.from(address) : address
    const nfts = this.erc721[addr.toString().toLowerCase()] || []
    return nfts
  }

  static etherFrom(notes: Note[]): Field {
    let sum = Field.from(0)
    for (const note of notes) {
      sum = sum.add(note.asset.eth)
    }
    return sum
  }

  static erc20From(notes: Note[]): { [addr: string]: Field } {
    const erc20: { [addr: string]: Field } = {}
    for (const note of notes) {
      const addr = note.asset.tokenAddr.toHex().toLowerCase()
      if (!note.asset.erc20Amount.isZero() && note.asset.nft.isZero()) {
        const prev = erc20[addr] ? erc20[addr] : Field.from(0)
        erc20[addr] = prev.add(note.asset.erc20Amount)
      }
    }
    return erc20
  }

  static nftsFrom(notes: Note[]): { [addr: string]: Field[] } {
    const erc721: { [addr: string]: Field[] } = {}
    for (const note of notes) {
      const addr = note.asset.tokenAddr.toHex().toLowerCase()
      if (note.asset.erc20Amount.isZero() && !note.asset.nft.isZero()) {
        if (!erc721[addr]) {
          erc721[addr] = []
        }
        erc721[addr].push(note.asset.nft)
      }
    }
    return erc721
  }

  static from(notes: Note[]): Sum {
    return new Sum(
      Sum.etherFrom(notes),
      Sum.erc20From(notes),
      Sum.nftsFrom(notes),
    )
  }
}
