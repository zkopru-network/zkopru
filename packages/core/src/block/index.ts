/* eslint-disable @typescript-eslint/camelcase */
// eslint-disable-next-line max-classes-per-file

export {
  MassDeposit,
  MassMigration,
  ERC20Migration,
  ERC721Migration,
  Header,
  Body,
  Finalization,
} from './types'

export {
  headerToSql,
  sqlToHeader,
  serializeHeader,
  serializeTxs,
  serializeMassDeposits,
  serializeMassMigrations,
  serializeBody,
  serializeFinalization,
  deserializeHeaderFrom,
  deserializeTxsFrom,
  deserializeMassDeposits,
  deserializeMassMigrations,
  headerHash,
  massDepositHash,
  massMigrationHash,
  getErc20Migrations,
  getErc721Migrations,
  getMassMigrationToAddress,
  getMassMigrations,
} from './utils'

export { Block } from './block'
export { genesis } from './genesis'
