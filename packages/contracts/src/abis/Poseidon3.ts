export const Poseidon3ABI = [
  {
    constant: true,
    inputs: [{ internalType: 'bytes32[3]', name: 'input', type: 'bytes32[3]' }],
    name: 'poseidon',
    outputs: [{ internalType: 'bytes32', name: '', type: 'bytes32' }],
    payable: false,
    stateMutability: 'pure',
    type: 'function',
  },
  {
    constant: true,
    inputs: [{ internalType: 'uint256[3]', name: 'input', type: 'uint256[3]' }],
    name: 'poseidon',
    outputs: [{ internalType: 'uint256', name: '', type: 'uint256' }],
    payable: false,
    stateMutability: 'pure',
    type: 'function',
  },
]
