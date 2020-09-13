export const IWithdrawalTreeChallengeABI = [
  {
    inputs: [
      { internalType: 'bytes', name: 'parentHeader', type: 'bytes' },
      { internalType: 'bytes', name: 'blockData', type: 'bytes' },
    ],
    name: 'challengeWithdrawalIndex',
    outputs: [],
    stateMutability: 'nonpayable',
    type: 'function',
  },
  {
    inputs: [
      { internalType: 'uint256[]', name: 'initialSiblings', type: 'uint256[]' },
      { internalType: 'bytes', name: 'parentHeader', type: 'bytes' },
      { internalType: 'bytes', name: 'blockData', type: 'bytes' },
    ],
    name: 'challengeWithdrawalRoot',
    outputs: [],
    stateMutability: 'nonpayable',
    type: 'function',
  },
]
