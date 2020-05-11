export const ICoordinatableABI = [
  {
    anonymous: false,
    inputs: [
      {
        indexed: false,
        internalType: 'bytes32',
        name: 'blockHash',
        type: 'bytes32',
      },
    ],
    name: 'Finalized',
    type: 'event',
  },
  {
    anonymous: false,
    inputs: [
      {
        indexed: false,
        internalType: 'uint256',
        name: 'index',
        type: 'uint256',
      },
      {
        indexed: false,
        internalType: 'bytes32',
        name: 'merged',
        type: 'bytes32',
      },
      { indexed: false, internalType: 'uint256', name: 'fee', type: 'uint256' },
    ],
    name: 'MassDepositCommit',
    type: 'event',
  },
  {
    anonymous: false,
    inputs: [
      {
        indexed: false,
        internalType: 'bytes32',
        name: 'blockHash',
        type: 'bytes32',
      },
    ],
    name: 'NewProposal',
    type: 'event',
  },
  {
    inputs: [],
    name: 'register',
    outputs: [],
    stateMutability: 'payable',
    type: 'function',
  },
  {
    inputs: [],
    name: 'deregister',
    outputs: [],
    stateMutability: 'nonpayable',
    type: 'function',
  },
  {
    inputs: [{ internalType: 'bytes', name: 'submission', type: 'bytes' }],
    name: 'propose',
    outputs: [],
    stateMutability: 'nonpayable',
    type: 'function',
  },
  {
    inputs: [
      { internalType: 'bytes32', name: 'submissionId', type: 'bytes32' },
      { internalType: 'bytes', name: 'finalization', type: 'bytes' },
    ],
    name: 'finalize',
    outputs: [],
    stateMutability: 'nonpayable',
    type: 'function',
  },
  {
    inputs: [{ internalType: 'uint256', name: 'amount', type: 'uint256' }],
    name: 'withdrawReward',
    outputs: [],
    stateMutability: 'nonpayable',
    type: 'function',
  },
  {
    inputs: [
      { internalType: 'address', name: 'proposerAddr', type: 'address' },
    ],
    name: 'isProposable',
    outputs: [{ internalType: 'bool', name: '', type: 'bool' }],
    stateMutability: 'view',
    type: 'function',
  },
]
