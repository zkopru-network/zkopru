import { soliditySha3Raw } from 'web3-utils'
import AbiCoder from 'web3-eth-abi'
import { Bytes32 } from 'soltypes'
import BN from 'bn.js'

export const PREPAY_DOMAIN_TYPEHASH = soliditySha3Raw(
  'PrepayRequest(address prepayer,bytes32 withdrawalHash,uint256 prepayFeeInEth,uint256 prepayFeeInToken,uint256 expiration)',
)
export const EIP712_DOMAIN_TYPEHASH = soliditySha3Raw(
  'EIP712Domain(string name,string version,uint256 chainId,address verifyingContract)',
)

export function prepayHash({
  prepayer,
  withdrawalHash,
  prepayFeeInEth,
  prepayFeeInToken,
  expiration,
  chainId,
  verifyingContract,
}: {
  prepayer: string
  withdrawalHash: string | Bytes32
  prepayFeeInEth: BN
  prepayFeeInToken: BN
  expiration: number
  chainId: number | string
  verifyingContract: string
}) {
  const encodeParameters = (AbiCoder as any).encodeParameters.bind(AbiCoder)
  const structParams = encodeParameters(
    ['bytes32', 'address', 'bytes32', 'uint256', 'uint256', 'uint256'],
    [
      PREPAY_DOMAIN_TYPEHASH,
      prepayer,
      typeof withdrawalHash === 'string'
        ? withdrawalHash
        : withdrawalHash.toString(),
      prepayFeeInEth,
      prepayFeeInToken,
      expiration,
    ],
  )
  const structHash = soliditySha3Raw(structParams)
  const domainName = soliditySha3Raw({
    t: 'bytes',
    v: `0x${Buffer.from('Zkopru', 'utf8').toString('hex')}`,
  })
  const domainVersion = soliditySha3Raw({
    t: 'bytes',
    v: `0x${Buffer.from('1', 'utf8').toString('hex')}`,
  })
  const separatorParams = encodeParameters(
    ['bytes32', 'bytes32', 'bytes32', 'uint256', 'address'],
    [
      EIP712_DOMAIN_TYPEHASH,
      domainName,
      domainVersion,
      +chainId,
      verifyingContract,
    ],
  )
  const seperator = soliditySha3Raw(separatorParams)
  // we can use the soliditySha3 directly because params are tightly packed
  return soliditySha3Raw(
    '\x19\x01',
    { t: 'bytes32', v: seperator },
    { t: 'bytes32', v: structHash },
  )
}
