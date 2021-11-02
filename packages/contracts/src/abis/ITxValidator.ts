export const ITxValidatorABI = [
  {
    inputs: [
      { internalType: 'bytes', name: 'blockData', type: 'bytes' },
      { internalType: 'uint256', name: 'txIndex', type: 'uint256' },
      { internalType: 'uint256', name: 'inflowIndex', type: 'uint256' },
    ],
    name: 'validateInclusion',
    outputs: [
      { internalType: 'bool', name: 'slash', type: 'bool' },
      { internalType: 'string', name: 'reason', type: 'string' },
    ],
    stateMutability: 'view',
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
  {
    inputs: [
      { internalType: 'bytes', name: 'blockData', type: 'bytes' },
      { internalType: 'uint256', name: 'txIndex', type: 'uint256' },
    ],
    name: 'validateOutflow',
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
      { internalType: 'uint256', name: 'txIndex', type: 'uint256' },
    ],
    name: 'validateAtomicSwap',
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
      { internalType: 'uint256', name: 'txIndex', type: 'uint256' },
      { internalType: 'uint256', name: 'inflowIndex', type: 'uint256' },
      { internalType: 'bytes32[254]', name: 'sibling', type: 'bytes32[254]' },
    ],
    name: 'validateUsedNullifier',
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
      { internalType: 'bytes32', name: 'nullifier', type: 'bytes32' },
    ],
    name: 'validateDuplicatedNullifier',
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
      { internalType: 'uint256', name: 'txIndex', type: 'uint256' },
    ],
    name: 'validateSNARK',
    outputs: [
      { internalType: 'bool', name: 'slash', type: 'bool' },
      { internalType: 'string', name: 'reason', type: 'string' },
    ],
    stateMutability: 'view',
    type: 'function',
  },
]
