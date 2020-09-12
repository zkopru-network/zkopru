export const ISetupWizardABI = [
  {
    inputs: [
      { internalType: 'uint8', name: 'numOfInputs', type: 'uint8' },
      { internalType: 'uint8', name: 'numOfOutputs', type: 'uint8' },
      {
        components: [
          {
            components: [
              { internalType: 'uint256', name: 'X', type: 'uint256' },
              { internalType: 'uint256', name: 'Y', type: 'uint256' },
            ],
            internalType: 'struct G1Point',
            name: 'alfa1',
            type: 'tuple',
          },
          {
            components: [
              { internalType: 'uint256[2]', name: 'X', type: 'uint256[2]' },
              { internalType: 'uint256[2]', name: 'Y', type: 'uint256[2]' },
            ],
            internalType: 'struct G2Point',
            name: 'beta2',
            type: 'tuple',
          },
          {
            components: [
              { internalType: 'uint256[2]', name: 'X', type: 'uint256[2]' },
              { internalType: 'uint256[2]', name: 'Y', type: 'uint256[2]' },
            ],
            internalType: 'struct G2Point',
            name: 'gamma2',
            type: 'tuple',
          },
          {
            components: [
              { internalType: 'uint256[2]', name: 'X', type: 'uint256[2]' },
              { internalType: 'uint256[2]', name: 'Y', type: 'uint256[2]' },
            ],
            internalType: 'struct G2Point',
            name: 'delta2',
            type: 'tuple',
          },
          {
            components: [
              { internalType: 'uint256', name: 'X', type: 'uint256' },
              { internalType: 'uint256', name: 'Y', type: 'uint256' },
            ],
            internalType: 'struct G1Point[]',
            name: 'ic',
            type: 'tuple[]',
          },
        ],
        internalType: 'struct SNARK.VerifyingKey',
        name: 'vk',
        type: 'tuple',
      },
    ],
    name: 'registerVk',
    outputs: [],
    stateMutability: 'nonpayable',
    type: 'function',
  },
  {
    inputs: [{ internalType: 'address', name: 'addr', type: 'address' }],
    name: 'makeUserInteractable',
    outputs: [],
    stateMutability: 'nonpayable',
    type: 'function',
  },
  {
    inputs: [
      { internalType: 'address', name: 'depositChallenge', type: 'address' },
      { internalType: 'address', name: 'headerChallenge', type: 'address' },
      { internalType: 'address', name: 'migrationChallenge', type: 'address' },
      { internalType: 'address', name: 'utxoTreeChallenge', type: 'address' },
      {
        internalType: 'address',
        name: 'withdrawalTreeChallenge',
        type: 'address',
      },
      {
        internalType: 'address',
        name: 'nullifierTreeChallenge',
        type: 'address',
      },
      { internalType: 'address', name: 'txChallenge', type: 'address' },
    ],
    name: 'makeChallengeable',
    outputs: [],
    stateMutability: 'nonpayable',
    type: 'function',
  },
  {
    inputs: [{ internalType: 'address', name: 'addr', type: 'address' }],
    name: 'makeMigratable',
    outputs: [],
    stateMutability: 'nonpayable',
    type: 'function',
  },
  {
    inputs: [
      { internalType: 'address[]', name: 'migrants', type: 'address[]' },
    ],
    name: 'allowMigrants',
    outputs: [],
    stateMutability: 'nonpayable',
    type: 'function',
  },
  {
    inputs: [],
    name: 'completeSetup',
    outputs: [],
    stateMutability: 'nonpayable',
    type: 'function',
  },
]
