export interface Challenge {
  code: ChallengeCode
  data?: any
}

export interface MassDepositChallenge {
  index: number
}

export type ChallengeData = MassDepositChallenge

export type ChallengeCode =
  | 'challengeMassDeposit'
  | 'challengeDepositRoot'
  | 'challengeTxRoot'
  | 'challengeMigrationRoot'
  | 'challengeTotalFee'
  | 'challengeMassMigrationToMassDeposit'
  | 'challengeERC20Migration'
  | 'challengeERC721Migration'
  | 'challengeUTXORollUp'
  | 'challengeNullifierRollUp'
  | 'challengeWithdrawalRollUp'
  | 'challengeInclusion'
  | 'challengeTransaction'
  | 'challengeUsedNullifier'
  | 'challengeDuplicatedNullifier'
