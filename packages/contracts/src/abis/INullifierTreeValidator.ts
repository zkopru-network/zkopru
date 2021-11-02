export const INullifierTreeValidatorABI = [
  {
    inputs: [
      { internalType: 'bytes', name: 'blockData', type: 'bytes' },
      { internalType: 'bytes', name: 'parentHeader', type: 'bytes' },
      { internalType: 'uint256', name: 'numOfNullifiers', type: 'uint256' },
      {
        internalType: 'bytes32[254][]',
        name: 'siblings',
        type: 'bytes32[254][]',
      },
    ],
    name: 'validateNullifierRollUp',
    outputs: [
      { internalType: 'bool', name: 'slash', type: 'bool' },
      { internalType: 'string', name: 'reason', type: 'string' },
    ],
    stateMutability: 'pure',
    type: 'function',
  },
]
