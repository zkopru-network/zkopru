/* eslint-disable @typescript-eslint/camelcase */
import { BigInteger } from 'big-integer'

export interface VerifyingKey {
  protocol: string
  nPublic: number
  vk_alfa_1: BigInteger[]
  vk_beta_2: BigInteger[][]
  vk_gamma_2: BigInteger[][]
  vk_delta_2: BigInteger[][]
  vk_alfabeta_12: BigInteger[][][]
  IC: BigInteger[][]
}
