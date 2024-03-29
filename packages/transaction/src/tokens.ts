import { Fp } from '@zkopru/babyjubjub'
import { Address } from 'soltypes'

export const DAI = '0x6b175474e89094c44da98b954eedeac495271d0f'
export const CRYPTO_KITTIES = '0x06012c8cf97bead5deae237070f9587f8e7a266d'

export class TokenRegistry {
  // Block number to start synchornize
  blockNumber = 0

  // Registered ERC20 token addresses
  erc20s: Address[] = []

  // Registered ERC721 token addresses
  erc721s: Address[] = []

  toJSON() {
    return {
      erc20s: this.erc20s,
      erc721s: this.erc721s,
    }
  }

  static getTokenId(addr: Fp): number {
    const id = addr.mod(256).toNumber()
    return id
  }

  addERC20(...addresses: (Address | string)[]) {
    this.erc20s.push(
      ...addresses.map(v => (typeof v === 'string' ? Address.from(v) : v)),
    )
  }

  addERC721(...addresses: (Address | string)[]) {
    this.erc721s.push(
      ...addresses.map(v => (typeof v === 'string' ? Address.from(v) : v)),
    )
  }

  getErc20Addresses(id: number): Fp[] {
    if (id >= 256) throw Error('Token identifier should have 8 bit value')
    const candidates = this.erc20s
      .filter(addr =>
        addr
          .toBigNumber()
          .mod(256)
          .eq(id),
      )
      .map(addr => Fp.from(addr.toBigNumber()))
    return candidates
  }

  getErc721Addresses(id: number): Fp[] {
    if (id >= 256) throw Error('Token identifier should have 8 bit value')
    const candidates = this.erc721s
      .filter(addr =>
        addr
          .toBigNumber()
          .mod(256)
          .eq(id),
      )
      .map(addr => Fp.from(addr.toBigNumber()))
    return candidates
  }
}
