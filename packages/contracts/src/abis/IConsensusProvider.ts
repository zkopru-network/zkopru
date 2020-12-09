export const IConsensusProviderABI = [
  {
    inputs: [],
    name: 'openRoundIfNeeded',
    outputs: [],
    stateMutability: 'nonpayable',
    type: 'function',
  },
  {
    inputs: [{ internalType: 'address', name: 'proposer', type: 'address' }],
    name: 'isProposable',
    outputs: [{ internalType: 'bool', name: '', type: 'bool' }],
    stateMutability: 'view',
    type: 'function',
  },
]
