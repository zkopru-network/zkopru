export const IDepositValidatorABI = [
  {
    inputs: [
      { internalType: 'bytes', name: 'blockData', type: 'bytes' },
      { internalType: 'uint256', name: 'index', type: 'uint256' },
    ],
    name: 'validateMassDeposit',
    outputs: [
      { internalType: 'bool', name: 'slash', type: 'bool' },
      { internalType: 'string', name: 'reason', type: 'string' },
    ],
    stateMutability: 'view',
    type: 'function',
  },
]
