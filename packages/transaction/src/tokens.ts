import { Field } from '@zkopru/babyjubjub'
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

  static getTokenId(addr: Field): number {
    const id = addr.modn(256)
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

  getErc20Addresses(id: number): Field[] {
    if (id >= 256) throw Error('Token identifier should have 8 bit value')
    const candidates = this.erc20s
      .filter(addr => addr.toBN().modn(256) === id)
      .map(addr => new Field(addr.toString()))
    return candidates
  }

  getErc721Addresses(id: number): Field[] {
    if (id >= 256) throw Error('Token identifier should have 8 bit value')
    const candidates = this.erc721s
      .filter(addr => addr.toBN().modn(256) === id)
      .map(addr => new Field(addr.toString()))
    return candidates
  }
}
