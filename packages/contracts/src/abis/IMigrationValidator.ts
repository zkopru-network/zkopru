export const IMigrationValidatorABI = [
  {
    inputs: [
      { internalType: 'bytes', name: 'blockData', type: 'bytes' },
      { internalType: 'uint256', name: 'massMigrationIdx1', type: 'uint256' },
      { internalType: 'uint256', name: 'massMigrationIdx2', type: 'uint256' },
    ],
    name: 'validateDuplicatedDestination',
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
      { internalType: 'uint256', name: 'migrationIndex', type: 'uint256' },
    ],
    name: 'validateTotalEth',
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
      { internalType: 'uint256', name: 'migrationIndex', type: 'uint256' },
    ],
    name: 'validateMergedLeaves',
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
      { internalType: 'uint256', name: 'migrationIndex', type: 'uint256' },
    ],
    name: 'validateMigrationFee',
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
      { internalType: 'uint256', name: 'migrationIndex', type: 'uint256' },
      { internalType: 'uint256', name: 'erc20MigrationIdx1', type: 'uint256' },
      { internalType: 'uint256', name: 'erc20MigrationIdx2', type: 'uint256' },
    ],
    name: 'validateDuplicatedERC20Migration',
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
      { internalType: 'uint256', name: 'migrationIndex', type: 'uint256' },
      { internalType: 'uint256', name: 'erc20Index', type: 'uint256' },
    ],
    name: 'validateERC20Amount',
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
      { internalType: 'uint256', name: 'migrationIndex', type: 'uint256' },
      { internalType: 'uint256', name: 'erc721MigrationIdx1', type: 'uint256' },
      { internalType: 'uint256', name: 'erc721MigrationIdx2', type: 'uint256' },
    ],
    name: 'validateDuplicatedERC721Migration',
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
      { internalType: 'uint256', name: 'migrationIndex', type: 'uint256' },
      { internalType: 'uint256', name: 'erc721Index', type: 'uint256' },
      { internalType: 'uint256', name: 'tokenId', type: 'uint256' },
    ],
    name: 'validateNonFungibility',
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
      { internalType: 'uint256', name: 'migrationIndex', type: 'uint256' },
      { internalType: 'uint256', name: 'erc721Index', type: 'uint256' },
      { internalType: 'uint256', name: 'tokenId', type: 'uint256' },
    ],
    name: 'validateNftExistence',
    outputs: [
      { internalType: 'bool', name: 'slash', type: 'bool' },
      { internalType: 'string', name: 'reason', type: 'string' },
    ],
    stateMutability: 'pure',
    type: 'function',
  },
]
