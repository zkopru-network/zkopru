import assert from 'assert'
import { BigNumber, utils } from 'ethers'
import {
  PREPAY_DOMAIN_TYPEHASH,
  EIP712_DOMAIN_TYPEHASH,
  prepayHash,
} from '../../src/eip712'

describe('eip712', () => {
  it('should have same prepay domain typehash', () => {
    const expectedTypehash =
      '0x2642c0f753eb8fa96c4c3903fdfe8e8df56aa45fc46995b5ad94ce6889db09a3'
    assert.equal(expectedTypehash, PREPAY_DOMAIN_TYPEHASH)
  })

  it('should have same eip712 domain typehash', () => {
    const expectedTypehash =
      '0x8b73c3c69bb8fe3d512ecc4cf759cc79239f7b179b0ffacaa9a75d522b39400f'
    assert.equal(expectedTypehash, EIP712_DOMAIN_TYPEHASH)
  })

  it('should have same prepay hash', () => {
    // Hard coded values calculated using remix IDE
    const expectedHash =
      '0x1496f59662b7ce256334938c1c9959547c1fd7163ecbfb0bf5d3196c64a968df'
    const withdrawalHash = utils.keccak256(utils.toUtf8Bytes('test hash'))
    const hash = prepayHash({
      prepayer: '0x0000000000000000000000000000000000000000',
      withdrawalHash,
      prepayFeeInEth: BigNumber.from('100'),
      prepayFeeInToken: BigNumber.from('200'),
      expiration: 500,
      chainId: '100',
      verifyingContract: '0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE',
    })
    assert.equal(hash, expectedHash)
  })
})
