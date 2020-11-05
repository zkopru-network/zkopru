export const UtxoTreeTesterABI = [
  {
    inputs: [
      { internalType: 'uint256', name: 'startingRoot', type: 'uint256' },
      { internalType: 'uint256', name: 'index', type: 'uint256' },
      { internalType: 'uint256[]', name: 'leaves', type: 'uint256[]' },
      { internalType: 'uint256[]', name: 'initialSiblings', type: 'uint256[]' },
    ],
    name: 'append',
    outputs: [{ internalType: 'uint256', name: 'newRoot', type: 'uint256' }],
    stateMutability: 'pure',
    type: 'function',
  },
  {
    inputs: [
      { internalType: 'uint256', name: 'root', type: 'uint256' },
      { internalType: 'uint256', name: 'leaf', type: 'uint256' },
      { internalType: 'uint256', name: 'index', type: 'uint256' },
      { internalType: 'uint256[]', name: 'siblings', type: 'uint256[]' },
    ],
    name: 'merkleProof',
    outputs: [{ internalType: 'bool', name: '', type: 'bool' }],
    stateMutability: 'pure',
    type: 'function',
  },
  {
    inputs: [
      { internalType: 'uint256', name: 'startingRoot', type: 'uint256' },
      { internalType: 'uint256', name: 'index', type: 'uint256' },
      { internalType: 'uint256', name: 'subTreeDepth', type: 'uint256' },
      { internalType: 'uint256[]', name: 'leaves', type: 'uint256[]' },
      { internalType: 'uint256[]', name: 'subTreeSiblings', type: 'uint256[]' },
    ],
    name: 'appendSubTree',
    outputs: [{ internalType: 'uint256', name: 'newRoot', type: 'uint256' }],
    stateMutability: 'pure',
    type: 'function',
  },
]
