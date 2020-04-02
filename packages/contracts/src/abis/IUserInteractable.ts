export const IUserInteractableABI = [
  {
    inputs: [
      { internalType: 'uint256', name: 'note', type: 'uint256' },
      { internalType: 'uint256', name: 'amount', type: 'uint256' },
      { internalType: 'uint256', name: 'fee', type: 'uint256' },
      { internalType: 'uint256[2]', name: 'pubKey', type: 'uint256[2]' },
    ],
    name: 'deposit',
    outputs: [],
    stateMutability: 'payable',
    type: 'function',
  },
  {
    inputs: [
      { internalType: 'uint256', name: 'amount', type: 'uint256' },
      { internalType: 'bytes32', name: 'proofHash', type: 'bytes32' },
      { internalType: 'uint256', name: 'rootIndex', type: 'uint256' },
      { internalType: 'uint256', name: 'leafIndex', type: 'uint256' },
      { internalType: 'uint256[]', name: 'siblings', type: 'uint256[]' },
    ],
    name: 'withdraw',
    outputs: [],
    stateMutability: 'nonpayable',
    type: 'function',
  },
  {
    inputs: [
      { internalType: 'uint256', name: 'amount', type: 'uint256' },
      { internalType: 'address', name: 'to', type: 'address' },
      { internalType: 'bytes32', name: 'proofHash', type: 'bytes32' },
      { internalType: 'uint256', name: 'rootIndex', type: 'uint256' },
      { internalType: 'uint256', name: 'leafIndex', type: 'uint256' },
      { internalType: 'uint256[]', name: 'siblings', type: 'uint256[]' },
      { internalType: 'uint8', name: 'v', type: 'uint8' },
      { internalType: 'bytes32', name: 'r', type: 'bytes32' },
      { internalType: 'bytes32', name: 's', type: 'bytes32' },
    ],
    name: 'withdrawUsingSignature',
    outputs: [],
    stateMutability: 'nonpayable',
    type: 'function',
  },
]
