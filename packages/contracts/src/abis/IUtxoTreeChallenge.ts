export const IUtxoTreeChallengeABI = [
  {
    inputs: [
      { internalType: 'uint256[]', name: 'deposits', type: 'uint256[]' },
      { internalType: 'bytes', name: 'parentHeader', type: 'bytes' },
      { internalType: 'bytes', name: 'submission', type: 'bytes' },
    ],
    name: 'challengeUTXOIndex',
    outputs: [],
    stateMutability: 'nonpayable',
    type: 'function',
  },
  {
    inputs: [
      { internalType: 'uint256[]', name: 'deposits', type: 'uint256[]' },
      { internalType: 'uint256[]', name: 'initialSiblings', type: 'uint256[]' },
      { internalType: 'bytes', name: 'parentHeader', type: 'bytes' },
      { internalType: 'bytes', name: 'submission', type: 'bytes' },
    ],
    name: 'challengeUTXORoot',
    outputs: [],
    stateMutability: 'nonpayable',
    type: 'function',
  },
]
