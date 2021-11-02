import { Config } from '../configurator/configurator'

export enum Menu {
  CREATE_WALLET,
  SET_PUBLIC_URLS,
  SET_WEBSOCKET,
  SET_DB,
  OUTPUT_PATH,
  COMPLETE,
}

export interface ExampleConfigContext {
  config: Config
  outputPath: string
}
