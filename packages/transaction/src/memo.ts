import { Bytes4 } from 'soltypes'

// eslint-disable-next-line @typescript-eslint/no-var-requires
const abiCoder = require('web3-eth-abi')

export const V2_MEMO_DEFAULT_ABI = Bytes4.from(
  abiCoder.encodeFunctionSignature({
    name: 'decodeMemoV2',
    type: 'function',
    inputs: [
      {
        type: 'bytes[]',
        name: 'memo',
      },
    ],
  }),
)

export const V2_MEMO_WITHDRAW_SIG_ABI = Bytes4.from(
  abiCoder.encodeFunctionSignature({
    name: 'decodeWithdrawSigMemoV2',
    type: 'function',
    inputs: [
      {
        type: 'bytes[]',
        name: 'memo',
      },
    ],
  }),
)

export enum MemoVersion {
  V1 = 1,
  V2 = 2,
}
export interface Memo {
  version: MemoVersion
  data: Buffer
}
