import { Bytes4 } from 'soltypes'
import { Interface } from 'ethers/lib/utils'

const abi = [
  'function decodeMemoV2(bytes[] memo)',
  'function decodeWithdrawSigMemoV2(bytes[] memo)',
]
export const V2_MEMO_DEFAULT_ABI = Bytes4.from(
  new Interface(abi).getSighash('decodeMemoV2'),
)
export const V2_MEMO_WITHDRAW_SIG_ABI = Bytes4.from(
  new Interface(abi).getSighash('decodeWithdrawSigMemoV2'),
)

export const V2_MEMO_DEFAULT_ABI_ZERO = Bytes4.from('0x00000000')
export const V2_MEMO_WITHDRAW_SIG_ABI_ZERO = Bytes4.from('0x00000001')

export enum MemoVersion {
  V1 = 1,
  V2 = 2,
}
export interface Memo {
  version: MemoVersion
  data: Buffer
}
