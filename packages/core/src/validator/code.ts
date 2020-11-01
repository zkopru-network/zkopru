export const CODE = {
  // Deposit challenge
  D1: 'This deposit queue is not committed.',
  // Header challenge
  H1: 'Header has invalid deposit root.',
  H2: 'Header has invalid transaction root.',
  H3: 'Header has invalid migration root.',
  H4: 'Header has invalid total fee value.',
  H5: 'Parent block is a slashed block.',
  // Migration challenge
  M1: 'Duplicated MassMigration destinations exist.',
  M2: 'MassMigration is carrying invalid amount of ETH.',
  M3: 'MassMigration is carrying invalid merged leaves value.',
  M4: 'Aggregated migration fee is not correct.',
  M5: 'Duplicated ERC20 migration destinations exist.',
  M6: 'MassMigration is carrying invalid amount of token.',
  M7: 'Duplicated ERC721 migration destinations exist.',
  M8: 'MassMigration is destroying the non-fungibility of a token.',
  M9: 'MassMigration is not including an NFT.',
  // Nullifier tree challenge
  N1: 'Nullifier root is different.',
  // SNARK challenge
  S1: 'Unsupported transaction type.',
  S2: 'Transaction is including an invalid snark proof.',
  // Tx challenge
  T1: 'An inflow is referencing an invalid UTXO root.',
  T2: 'An outflow has an invalid type. Only 0, 1, and 2 are allowed.',
  T3: 'UTXO type of outflow cannot have public data.',
  T4: 'Transaction is including unregistered token.',
  T5: 'This note cannot have NFT field.',
  T6: 'This note cannot have ERC20 field.',
  T7: 'ZK SNARK Circuit does not support NFT which id is 0.',
  T8: 'Atomic swap transaction allows only 1 counterpart transaction.',
  T9: 'Transaction is using an already spent nullifier.',
  T10: 'Some transactions in the block are trying to use a same nullifier.',
  // Utxo tree challenge
  U1: 'The updated number of total UTXO is not correct.',
  U2: 'The updated number of total UTXO is exceeding the maximum value.',
  U3: 'The updated utxo tree root is not correct.',
  // Withdrawal tree challenge
  W1: 'The updated number of total Withdarawls is not correct.',
  W2: 'The updated number of total Withdrawals is exceeding the maximum value.',
  W3: 'The updated withdrawal tree root is not correct.',
}

export function challengeCodeToString(code: string): string {
  const str = CODE[code]
  return str || code
}
