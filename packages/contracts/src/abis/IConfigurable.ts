export const IConfigurableABI = [
  {
    anonymous: false,
    inputs: [
      { indexed: false, internalType: 'string', name: 'name', type: 'string' },
      {
        indexed: false,
        internalType: 'uint256',
        name: 'value',
        type: 'uint256',
      },
    ],
    name: 'Update',
    type: 'event',
  },
  {
    inputs: [{ internalType: 'uint256', name: 'blockSize', type: 'uint256' }],
    name: 'setMaxBlockSize',
    outputs: [],
    stateMutability: 'nonpayable',
    type: 'function',
  },
  {
    inputs: [{ internalType: 'uint256', name: 'maxGas', type: 'uint256' }],
    name: 'setMaxValidationGas',
    outputs: [],
    stateMutability: 'nonpayable',
    type: 'function',
  },
  {
    inputs: [{ internalType: 'uint256', name: 'period', type: 'uint256' }],
    name: 'setChallengePeriod',
    outputs: [],
    stateMutability: 'nonpayable',
    type: 'function',
  },
  {
    inputs: [{ internalType: 'uint256', name: 'stake', type: 'uint256' }],
    name: 'setMinimumStake',
    outputs: [],
    stateMutability: 'nonpayable',
    type: 'function',
  },
  {
    inputs: [{ internalType: 'uint256', name: 'depth', type: 'uint256' }],
    name: 'setReferenceDepth',
    outputs: [],
    stateMutability: 'nonpayable',
    type: 'function',
  },
  {
    inputs: [{ internalType: 'address', name: 'provider', type: 'address' }],
    name: 'setConsensusProvider',
    outputs: [],
    stateMutability: 'nonpayable',
    type: 'function',
  },
]
