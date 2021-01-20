import { Config } from '../configurator/configurator'

export enum Menu {
  CREATE_WALLET,
  SET_PUBLIC_URLS,
  SET_WEBSOCKET,
  COMPLETE,
}

export interface ExampleConfigContext {
  config: Config
  outputPath: string
}
