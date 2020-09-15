export const IMigrationChallengeABI = [
  {
    inputs: [
      { internalType: 'uint256', name: 'massMigrationIdx1', type: 'uint256' },
      { internalType: 'uint256', name: 'massMigrationIdx2', type: 'uint256' },
      { internalType: 'bytes', name: 'blockData', type: 'bytes' },
    ],
    name: 'challengeDuplicatedDestination',
    outputs: [],
    stateMutability: 'nonpayable',
    type: 'function',
  },
  {
    inputs: [
      { internalType: 'uint256', name: 'migrationIndex', type: 'uint256' },
      { internalType: 'bytes', name: 'blockData', type: 'bytes' },
    ],
    name: 'challengeTotalEth',
    outputs: [],
    stateMutability: 'nonpayable',
    type: 'function',
  },
  {
    inputs: [
      { internalType: 'uint256', name: 'migrationIndex', type: 'uint256' },
      { internalType: 'bytes', name: 'blockData', type: 'bytes' },
    ],
    name: 'challengeMergedLeaves',
    outputs: [],
    stateMutability: 'nonpayable',
    type: 'function',
  },
  {
    inputs: [
      { internalType: 'uint256', name: 'migrationIndex', type: 'uint256' },
      { internalType: 'bytes', name: 'blockData', type: 'bytes' },
    ],
    name: 'challengeMigrationFee',
    outputs: [],
    stateMutability: 'nonpayable',
    type: 'function',
  },
  {
    inputs: [
      { internalType: 'uint256', name: 'migrationIndex', type: 'uint256' },
      { internalType: 'uint256', name: 'erc20MingrationIdx1', type: 'uint256' },
      { internalType: 'uint256', name: 'erc20MingrationIdx2', type: 'uint256' },
      { internalType: 'bytes', name: 'blockData', type: 'bytes' },
    ],
    name: 'challengeDuplicatedERC20Migration',
    outputs: [],
    stateMutability: 'nonpayable',
    type: 'function',
  },
  {
    inputs: [
      { internalType: 'uint256', name: 'migrationIndex', type: 'uint256' },
      { internalType: 'uint256', name: 'erc20Index', type: 'uint256' },
      { internalType: 'bytes', name: 'blockData', type: 'bytes' },
    ],
    name: 'challengeERC20Amount',
    outputs: [],
    stateMutability: 'nonpayable',
    type: 'function',
  },
  {
    inputs: [
      { internalType: 'uint256', name: 'migrationIndex', type: 'uint256' },
      {
        internalType: 'uint256',
        name: 'erc721MingrationIdx1',
        type: 'uint256',
      },
      {
        internalType: 'uint256',
        name: 'erc721MingrationIdx2',
        type: 'uint256',
      },
      { internalType: 'bytes', name: 'blockData', type: 'bytes' },
    ],
    name: 'challengeDuplicatedERC721Migration',
    outputs: [],
    stateMutability: 'nonpayable',
    type: 'function',
  },
  {
    inputs: [
      { internalType: 'uint256', name: 'migrationIndex', type: 'uint256' },
      { internalType: 'uint256', name: 'erc721Index', type: 'uint256' },
      { internalType: 'uint256', name: 'tokenId', type: 'uint256' },
      { internalType: 'bytes', name: 'blockData', type: 'bytes' },
    ],
    name: 'challengeNonFungibility',
    outputs: [],
    stateMutability: 'nonpayable',
    type: 'function',
  },
  {
    inputs: [
      { internalType: 'uint256', name: 'migrationIndex', type: 'uint256' },
      { internalType: 'uint256', name: 'erc721Index', type: 'uint256' },
      { internalType: 'uint256', name: 'tokenId', type: 'uint256' },
      { internalType: 'bytes', name: 'blockData', type: 'bytes' },
    ],
    name: 'challengeNftExistence',
    outputs: [],
    stateMutability: 'nonpayable',
    type: 'function',
  },
]
