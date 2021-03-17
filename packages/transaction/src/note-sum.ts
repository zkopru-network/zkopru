import { Fp } from '@zkopru/babyjubjub'
import { Address } from 'soltypes'
import { Note } from './note'

export class Sum {
  eth: Fp

  erc20: { [addr: string]: Fp }

  erc721: { [addr: string]: Fp[] }

  constructor(
    eth: Fp,
    erc20: { [addr: string]: Fp },
    erc721: { [addr: string]: Fp[] },
  ) {
    this.eth = eth
    this.erc20 = erc20
    this.erc721 = erc721
  }

  getERC20(address: Address | string): Fp {
    const addr: Address =
      typeof address === 'string' ? Address.from(address) : address
    const amount = this.erc20[addr.toString()] || Fp.zero
    return amount
  }

  getNFTs(address: Address | string): Fp[] {
    const addr: Address =
      typeof address === 'string' ? Address.from(address) : address
    const nfts = this.erc721[addr.toString()] || []
    return nfts
  }

  static etherFrom(notes: Note[]): Fp {
    let sum = Fp.from(0)
    for (const note of notes) {
      sum = sum.add(note.asset.eth)
    }
    return sum
  }

  static erc20From(notes: Note[]): { [addr: string]: Fp } {
    const erc20: { [addr: string]: Fp } = {}
    for (const note of notes) {
      const addr = Address.from(note.asset.tokenAddr.toHex()).toString()
      if (!note.asset.erc20Amount.isZero() && note.asset.nft.isZero()) {
        const prev = erc20[addr] ? erc20[addr] : Fp.from(0)
        erc20[addr] = prev.add(note.asset.erc20Amount)
      }
    }
    return erc20
  }

  static nftsFrom(notes: Note[]): { [addr: string]: Fp[] } {
    const erc721: { [addr: string]: Fp[] } = {}
    for (const note of notes) {
      const addr = Address.from(note.asset.tokenAddr.toHex()).toString()
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
