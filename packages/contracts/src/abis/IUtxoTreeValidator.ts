export const IUtxoTreeValidatorABI = [
  {
    inputs: [
      { internalType: 'bytes', name: 'blockData', type: 'bytes' },
      { internalType: 'bytes', name: 'parentHeader', type: 'bytes' },
      { internalType: 'uint256[]', name: 'deposits', type: 'uint256[]' },
    ],
    name: 'validateUTXOIndex',
    outputs: [
      { internalType: 'bool', name: 'slash', type: 'bool' },
      { internalType: 'string', name: 'reason', type: 'string' },
    ],
    stateMutability: 'pure',
    type: 'function',
  },
  {
    inputs: [
      { internalType: 'bytes', name: 'blockData', type: 'bytes' },
      { internalType: 'bytes', name: 'parentHeader', type: 'bytes' },
      { internalType: 'uint256[]', name: 'deposits', type: 'uint256[]' },
      { internalType: 'uint256[]', name: 'initialSiblings', type: 'uint256[]' },
    ],
    name: 'validateUTXORoot',
    outputs: [
      { internalType: 'bool', name: 'slash', type: 'bool' },
      { internalType: 'string', name: 'reason', type: 'string' },
    ],
    stateMutability: 'pure',
    type: 'function',
  },
]
