export const ITxSNARKChallengeABI = [
  {
    inputs: [
      { internalType: 'uint256', name: 'txIndex', type: 'uint256' },
      { internalType: 'bytes', name: 'blockData', type: 'bytes' },
    ],
    name: 'challengeSNARK',
    outputs: [],
    stateMutability: 'nonpayable',
    type: 'function',
  },
  {
    inputs: [
      {
        components: [
          {
            components: [
              {
                internalType: 'uint256',
                name: 'inclusionRoot',
                type: 'uint256',
              },
              { internalType: 'bytes32', name: 'nullifier', type: 'bytes32' },
            ],
            internalType: 'struct Inflow[]',
            name: 'inflow',
            type: 'tuple[]',
          },
          {
            components: [
              { internalType: 'uint256', name: 'note', type: 'uint256' },
              { internalType: 'uint8', name: 'outflowType', type: 'uint8' },
              {
                components: [
                  { internalType: 'address', name: 'to', type: 'address' },
                  { internalType: 'uint256', name: 'eth', type: 'uint256' },
                  { internalType: 'address', name: 'token', type: 'address' },
                  { internalType: 'uint256', name: 'amount', type: 'uint256' },
                  { internalType: 'uint256', name: 'nft', type: 'uint256' },
                  { internalType: 'uint256', name: 'fee', type: 'uint256' },
                ],
                internalType: 'struct PublicData',
                name: 'publicData',
                type: 'tuple',
              },
            ],
            internalType: 'struct Outflow[]',
            name: 'outflow',
            type: 'tuple[]',
          },
          { internalType: 'uint256', name: 'swap', type: 'uint256' },
          { internalType: 'uint256', name: 'fee', type: 'uint256' },
          {
            components: [
              {
                components: [
                  { internalType: 'uint256', name: 'X', type: 'uint256' },
                  { internalType: 'uint256', name: 'Y', type: 'uint256' },
                ],
                internalType: 'struct G1Point',
                name: 'a',
                type: 'tuple',
              },
              {
                components: [
                  { internalType: 'uint256[2]', name: 'X', type: 'uint256[2]' },
                  { internalType: 'uint256[2]', name: 'Y', type: 'uint256[2]' },
                ],
                internalType: 'struct G2Point',
                name: 'b',
                type: 'tuple',
              },
              {
                components: [
                  { internalType: 'uint256', name: 'X', type: 'uint256' },
                  { internalType: 'uint256', name: 'Y', type: 'uint256' },
                ],
                internalType: 'struct G1Point',
                name: 'c',
                type: 'tuple',
              },
            ],
            internalType: 'struct Proof',
            name: 'proof',
            type: 'tuple',
          },
          { internalType: 'bytes', name: 'memo', type: 'bytes' },
        ],
        internalType: 'struct Transaction',
        name: 'transaction',
        type: 'tuple',
      },
    ],
    name: 'hasValidSNARK',
    outputs: [
      { internalType: 'bool', name: 'result', type: 'bool' },
      { internalType: 'string', name: 'reason', type: 'string' },
    ],
    stateMutability: 'view',
    type: 'function',
  },
]
