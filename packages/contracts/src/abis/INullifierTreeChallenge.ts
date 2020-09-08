export const INullifierTreeChallengeABI = [
  {
    inputs: [
      { internalType: 'uint256', name: 'numOfNullifiers', type: 'uint256' },
      {
        internalType: 'bytes32[254][]',
        name: 'siblings',
        type: 'bytes32[254][]',
      },
      { internalType: 'bytes', name: 'parentHeader', type: 'bytes' },
      { internalType: 'bytes', name: 'submission', type: 'bytes' },
    ],
    name: 'challengeNullifierRollUp',
    outputs: [],
    stateMutability: 'nonpayable',
    type: 'function',
  },
]
