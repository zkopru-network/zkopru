export const IMigratableABI = [
  {
    inputs: [
      { internalType: 'address', name: 'source', type: 'address' },
      { internalType: 'bytes32', name: 'migrationRoot', type: 'bytes32' },
      {
        components: [
          { internalType: 'address', name: 'destination', type: 'address' },
          {
            components: [
              { internalType: 'uint256', name: 'eth', type: 'uint256' },
              { internalType: 'address', name: 'token', type: 'address' },
              { internalType: 'uint256', name: 'amount', type: 'uint256' },
            ],
            internalType: 'struct MigrationAsset',
            name: 'asset',
            type: 'tuple',
          },
          {
            components: [
              { internalType: 'bytes32', name: 'merged', type: 'bytes32' },
              { internalType: 'uint256', name: 'fee', type: 'uint256' },
            ],
            internalType: 'struct MassDeposit',
            name: 'depositForDest',
            type: 'tuple',
          },
        ],
        internalType: 'struct MassMigration',
        name: 'migration',
        type: 'tuple',
      },
      { internalType: 'uint256', name: 'index', type: 'uint256' },
      { internalType: 'bytes32[]', name: 'siblings', type: 'bytes32[]' },
      { internalType: 'bytes32[]', name: 'leaves', type: 'bytes32[]' },
    ],
    name: 'migrateFrom',
    outputs: [],
    stateMutability: 'nonpayable',
    type: 'function',
  },
  {
    inputs: [
      { internalType: 'bytes32', name: 'migrationRoot', type: 'bytes32' },
      {
        components: [
          { internalType: 'address', name: 'destination', type: 'address' },
          {
            components: [
              { internalType: 'uint256', name: 'eth', type: 'uint256' },
              { internalType: 'address', name: 'token', type: 'address' },
              { internalType: 'uint256', name: 'amount', type: 'uint256' },
            ],
            internalType: 'struct MigrationAsset',
            name: 'asset',
            type: 'tuple',
          },
          {
            components: [
              { internalType: 'bytes32', name: 'merged', type: 'bytes32' },
              { internalType: 'uint256', name: 'fee', type: 'uint256' },
            ],
            internalType: 'struct MassDeposit',
            name: 'depositForDest',
            type: 'tuple',
          },
        ],
        internalType: 'struct MassMigration',
        name: 'migration',
        type: 'tuple',
      },
      { internalType: 'uint256', name: 'index', type: 'uint256' },
      { internalType: 'bytes32[]', name: 'siblings', type: 'bytes32[]' },
    ],
    name: 'transfer',
    outputs: [],
    stateMutability: 'nonpayable',
    type: 'function',
  },
]
