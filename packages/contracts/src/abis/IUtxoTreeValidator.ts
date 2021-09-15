export const IUtxoTreeValidatorABI = [
  {
    inputs: [
      { internalType: 'uint256', name: 'startingRoot', type: 'uint256' },
      { internalType: 'uint256', name: 'startingIndex', type: 'uint256' },
      { internalType: 'uint256[]', name: 'initialSiblings', type: 'uint256[]' },
    ],
    name: 'newProof',
    outputs: [],
    stateMutability: 'nonpayable',
    type: 'function',
  },
  {
    inputs: [
      { internalType: 'uint256', name: 'proofId', type: 'uint256' },
      { internalType: 'uint256[]', name: 'leaves', type: 'uint256[]' },
    ],
    name: 'updateProof',
    outputs: [],
    stateMutability: 'nonpayable',
    type: 'function',
  },
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
  {
    inputs: [
      { internalType: 'bytes', name: 'blockData', type: 'bytes' },
      { internalType: 'bytes', name: 'parentHeader', type: 'bytes' },
      { internalType: 'uint256[]', name: '_deposits', type: 'uint256[]' },
      { internalType: 'uint256', name: 'proofId', type: 'uint256' },
    ],
    name: 'validateUTXORootWithProof',
    outputs: [
      { internalType: 'bool', name: 'slash', type: 'bool' },
      { internalType: 'string', name: 'reason', type: 'string' },
    ],
    stateMutability: 'view',
    type: 'function',
  },
  {
    inputs: [{ internalType: 'uint256', name: 'proofId', type: 'uint256' }],
    name: 'getProof',
    outputs: [
      { internalType: 'address', name: 'owner', type: 'address' },
      { internalType: 'uint256', name: 'startRoot', type: 'uint256' },
      { internalType: 'uint256', name: 'startIndex', type: 'uint256' },
      { internalType: 'uint256', name: 'resultRoot', type: 'uint256' },
      { internalType: 'uint256', name: 'resultIndex', type: 'uint256' },
      { internalType: 'bytes32', name: 'mergedLeaves', type: 'bytes32' },
      { internalType: 'uint256[]', name: 'cachedSiblings', type: 'uint256[]' },
    ],
    stateMutability: 'view',
    type: 'function',
  },
]
