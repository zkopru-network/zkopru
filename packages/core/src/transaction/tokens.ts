import { hexToNumber, padLeft, toChecksumAddress } from 'web3-utils'
import { Field } from '../crypto/field'

export const DAI = '0x6b175474e89094c44da98b954eedeac495271d0f'
export const CRYPTO_KITTIES = '0x06012c8cf97bead5deae237070f9587f8e7a266d'

const tokenIdMap: Record<string, number> = {}
tokenIdMap['0x0'] = 0
tokenIdMap[DAI] = 1
tokenIdMap[CRYPTO_KITTIES] = 2

export function getTokenId(addr: Field): number {
  const hexAddr = padLeft(`0x${addr.val.toString(16)}`, 40)
  const checkSumAddress = toChecksumAddress(hexAddr)
  let id = tokenIdMap[checkSumAddress]
  if (id === undefined) {
    id = 0
  }
  if (id >= 256) throw Error('Only support maximum 255 number of tokens')
  return id
}

export function getTokenAddress(id: number): Field | null {
  if (id >= 256) throw Error('Only support maximum 255 number of tokens')
  let key = id
  if (typeof id === 'string') {
    key = hexToNumber(id)
  }
  for (const obj in tokenIdMap) {
    if (tokenIdMap[obj] === key) return Field.from(obj)
  }
  return null
}
