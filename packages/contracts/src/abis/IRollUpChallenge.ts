export const IRollUpChallengeABI = [
  {
    inputs: [
      { internalType: 'uint256', name: 'proofId', type: 'uint256' },
      { internalType: 'uint256[]', name: 'deposits', type: 'uint256[]' },
      { internalType: 'uint256', name: 'numOfUTXO', type: 'uint256' },
      { internalType: 'bytes', name: 'parentHeader', type: 'bytes' },
      { internalType: 'bytes', name: 'submission', type: 'bytes' },
    ],
    name: 'challengeUTXORollUp',
    outputs: [],
    stateMutability: 'nonpayable',
    type: 'function',
  },
  {
    inputs: [
      { internalType: 'uint256', name: 'proofId', type: 'uint256' },
      { internalType: 'uint256', name: 'numOfNullifiers', type: 'uint256' },
      { internalType: 'bytes', name: 'parentHeader', type: 'bytes' },
      { internalType: 'bytes', name: 'submission', type: 'bytes' },
    ],
    name: 'challengeNullifierRollUp',
    outputs: [],
    stateMutability: 'nonpayable',
    type: 'function',
  },
  {
    inputs: [
      { internalType: 'uint256', name: 'proofId', type: 'uint256' },
      { internalType: 'uint256', name: 'numOfWithdrawals', type: 'uint256' },
      { internalType: 'bytes', name: 'parentHeader', type: 'bytes' },
      { internalType: 'bytes', name: 'submission', type: 'bytes' },
    ],
    name: 'challengeWithdrawalRollUp',
    outputs: [],
    stateMutability: 'nonpayable',
    type: 'function',
  },
]
