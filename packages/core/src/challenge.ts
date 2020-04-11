import { Block } from './block'

export enum ChallengeCode {
  NOT_SUPPORTED_TYPE,
  INVALID_SNARK,
}

export interface Challenge {
  code: ChallengeCode
  block: Block
}
