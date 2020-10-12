export const IWithdrawalTreeValidatorABI = [
  {
    inputs: [
      { internalType: 'bytes', name: 'blockData', type: 'bytes' },
      { internalType: 'bytes', name: 'parentHeader', type: 'bytes' },
    ],
    name: 'validateWithdrawalIndex',
    outputs: [
      { internalType: 'bool', name: 'slash', type: 'bool' },
      { internalType: 'string', name: 'reason', type: 'string' },
    ],
    stateMutability: 'view',
    type: 'function',
  },
  {
    inputs: [
      { internalType: 'bytes', name: 'blockData', type: 'bytes' },
      { internalType: 'bytes', name: 'parentHeader', type: 'bytes' },
      { internalType: 'uint256[]', name: 'initialSiblings', type: 'uint256[]' },
    ],
    name: 'validateWithdrawalRoot',
    outputs: [
      { internalType: 'bool', name: 'slash', type: 'bool' },
      { internalType: 'string', name: 'reason', type: 'string' },
    ],
    stateMutability: 'view',
    type: 'function',
  },
]
