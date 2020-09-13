export const ITxChallengeABI = [
  {
    inputs: [
      { internalType: 'uint256', name: 'txIndex', type: 'uint256' },
      { internalType: 'uint256', name: 'inflowIndex', type: 'uint256' },
      { internalType: 'bytes', name: 'blockData', type: 'bytes' },
    ],
    name: 'challengeInclusion',
    outputs: [],
    stateMutability: 'nonpayable',
    type: 'function',
  },
  {
    inputs: [
      { internalType: 'uint256', name: 'txIndex', type: 'uint256' },
      { internalType: 'bytes', name: 'blockData', type: 'bytes' },
    ],
    name: 'challengeTransaction',
    outputs: [],
    stateMutability: 'nonpayable',
    type: 'function',
  },
  {
    inputs: [
      { internalType: 'uint256', name: 'txIndex', type: 'uint256' },
      { internalType: 'bytes', name: 'blockData', type: 'bytes' },
    ],
    name: 'challengeAtomicSwap',
    outputs: [],
    stateMutability: 'nonpayable',
    type: 'function',
  },
  {
    inputs: [
      { internalType: 'uint256', name: 'txIndex', type: 'uint256' },
      { internalType: 'uint256', name: 'inflowIndex', type: 'uint256' },
      { internalType: 'bytes32[254]', name: 'sibling', type: 'bytes32[254]' },
      { internalType: 'bytes', name: 'blockData', type: 'bytes' },
    ],
    name: 'challengeUsedNullifier',
    outputs: [],
    stateMutability: 'nonpayable',
    type: 'function',
  },
  {
    inputs: [
      { internalType: 'bytes32', name: 'nullifier', type: 'bytes32' },
      { internalType: 'bytes', name: 'blockData', type: 'bytes' },
    ],
    name: 'challengeDuplicatedNullifier',
    outputs: [],
    stateMutability: 'nonpayable',
    type: 'function',
  },
  {
    inputs: [
      { internalType: 'bytes32', name: 'l2BlockHash', type: 'bytes32' },
      { internalType: 'uint256', name: 'ref', type: 'uint256' },
    ],
    name: 'isValidRef',
    outputs: [{ internalType: 'bool', name: '', type: 'bool' }],
    stateMutability: 'view',
    type: 'function',
  },
]
