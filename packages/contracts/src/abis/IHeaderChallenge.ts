export const IHeaderChallengeABI = [
  {
    inputs: [{ internalType: 'bytes', name: 'blockData', type: 'bytes' }],
    name: 'challengeDepositRoot',
    outputs: [],
    stateMutability: 'nonpayable',
    type: 'function',
  },
  {
    inputs: [{ internalType: 'bytes', name: 'blockData', type: 'bytes' }],
    name: 'challengeTxRoot',
    outputs: [],
    stateMutability: 'nonpayable',
    type: 'function',
  },
  {
    inputs: [{ internalType: 'bytes', name: 'blockData', type: 'bytes' }],
    name: 'challengeMigrationRoot',
    outputs: [],
    stateMutability: 'nonpayable',
    type: 'function',
  },
  {
    inputs: [{ internalType: 'bytes', name: 'blockData', type: 'bytes' }],
    name: 'challengeTotalFee',
    outputs: [],
    stateMutability: 'nonpayable',
    type: 'function',
  },
]
