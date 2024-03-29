import { Bytes32 } from 'soltypes'
import { BigNumber, utils } from 'ethers'

export const PREPAY_DOMAIN_TYPEHASH = utils.keccak256(
  utils.toUtf8Bytes(
    'PrepayRequest(address prepayer,bytes32 withdrawalHash,uint256 prepayFeeInEth,uint256 prepayFeeInToken,uint256 expiration)',
  ),
)
export const EIP712_DOMAIN_TYPEHASH = utils.keccak256(
  utils.toUtf8Bytes(
    'EIP712Domain(string name,string version,uint256 chainId,address verifyingContract)',
  ),
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
  prepayFeeInEth: BigNumber
  prepayFeeInToken: BigNumber
  expiration: number
  chainId: number | string
  verifyingContract: string
}) {
  const abiCoder = utils.defaultAbiCoder
  const structParams = abiCoder.encode(
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
  const structHash = utils.keccak256(structParams)
  const domainName = utils.keccak256(Buffer.from('Zkopru', 'utf8'))
  const domainVersion = utils.keccak256(Buffer.from('1', 'utf8'))
  const separatorParams = abiCoder.encode(
    ['bytes32', 'bytes32', 'bytes32', 'uint256', 'address'],
    [
      EIP712_DOMAIN_TYPEHASH,
      domainName,
      domainVersion,
      BigNumber.from(chainId),
      verifyingContract,
    ],
  )
  const separator = utils.keccak256(separatorParams)
  const concatenated = '0x1901'.concat(separator.slice(2)).concat(structHash.slice(2))
  return utils.keccak256(concatenated)
}
