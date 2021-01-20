import { DEFAULT, externalIp } from '../config'
import CreateWallet from './prompts/create-wallet'
import SetPublicUrl from './prompts/set-public-url'
import SetWebsocket from './prompts/set-websocket'
import { Config } from '../configurator/configurator'
import { Menu } from './menu'

export async function getExampleConfig(
  outputPath: string,
  onError?: () => Promise<void>,
): Promise<{ config: Config; outputPath: string }> {
  const onCancel =
    onError ||
    (async () => {
      process.exit(1)
    })
  const exampleConfig = {
    ...DEFAULT,
    publicUrls: `${await externalIp()}:${DEFAULT.port},127.0.0.1:${
      DEFAULT.port
    }`,
  } as Config
  const options = {
    base: exampleConfig,
    onCancel,
  }
  const apps = {
    [Menu.CREATE_WALLET]: new CreateWallet(options),
    [Menu.SET_PUBLIC_URLS]: new SetPublicUrl(options),
    [Menu.SET_WEBSOCKET]: new SetWebsocket(options),
  }
  let next = Menu.CREATE_WALLET
  while (next !== Menu.COMPLETE) {
    const app = apps[next]
    if (app) {
      const { next: newNext, context } = await app.run(exampleConfig)
      next = newNext
      Object.assign(exampleConfig, context)
    } else break
  }
  return {
    config: exampleConfig,
    outputPath,
  }
}
