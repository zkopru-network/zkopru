export const IRollUpableABI = [
  {
    inputs: [
      { internalType: 'uint256', name: 'startingRoot', type: 'uint256' },
      { internalType: 'uint256', name: 'startingIndex', type: 'uint256' },
      { internalType: 'uint256[]', name: 'initialSiblings', type: 'uint256[]' },
    ],
    name: 'newProofOfUTXORollUp',
    outputs: [],
    stateMutability: 'nonpayable',
    type: 'function',
  },
  {
    inputs: [{ internalType: 'bytes32', name: 'prevRoot', type: 'bytes32' }],
    name: 'newProofOfNullifierRollUp',
    outputs: [],
    stateMutability: 'nonpayable',
    type: 'function',
  },
  {
    inputs: [
      { internalType: 'uint256', name: 'startingRoot', type: 'uint256' },
      { internalType: 'uint256', name: 'startingIndex', type: 'uint256' },
    ],
    name: 'newProofOfWithdrawalRollUp',
    outputs: [],
    stateMutability: 'nonpayable',
    type: 'function',
  },
  {
    inputs: [
      { internalType: 'uint256', name: 'id', type: 'uint256' },
      { internalType: 'uint256[]', name: 'leaves', type: 'uint256[]' },
    ],
    name: 'updateProofOfUTXORollUp',
    outputs: [],
    stateMutability: 'nonpayable',
    type: 'function',
  },
  {
    inputs: [
      { internalType: 'uint256', name: 'id', type: 'uint256' },
      { internalType: 'bytes32[]', name: 'leaves', type: 'bytes32[]' },
      {
        internalType: 'bytes32[254][]',
        name: 'siblings',
        type: 'bytes32[254][]',
      },
    ],
    name: 'updateProofOfNullifierRollUp',
    outputs: [],
    stateMutability: 'nonpayable',
    type: 'function',
  },
  {
    inputs: [
      { internalType: 'uint256', name: 'id', type: 'uint256' },
      { internalType: 'uint256[]', name: 'initialSiblings', type: 'uint256[]' },
      { internalType: 'uint256[]', name: 'leaves', type: 'uint256[]' },
    ],
    name: 'updateProofOfWithdrawalRollUp',
    outputs: [],
    stateMutability: 'nonpayable',
    type: 'function',
  },
]
