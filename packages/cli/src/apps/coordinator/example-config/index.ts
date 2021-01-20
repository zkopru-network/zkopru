import { DEFAULT, externalIp } from '../config'
import CreateWallet from './prompts/create-wallet'
import SetPublicUrl from './prompts/set-public-url'
import SetWebsocket from './prompts/set-websocket'
import OutputPath from './prompts/output-path'
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
    base: undefined,
    onCancel,
  }
  const apps = {
    [Menu.CREATE_WALLET]: new CreateWallet(options),
    [Menu.SET_PUBLIC_URLS]: new SetPublicUrl(options),
    [Menu.SET_WEBSOCKET]: new SetWebsocket(options),
    [Menu.OUTPUT_PATH]: new OutputPath(options),
  }
  const context = {
    config: exampleConfig,
    outputPath,
  }
  let next = Menu.CREATE_WALLET
  while (next !== Menu.COMPLETE) {
    const app = apps[next]
    if (app) {
      const {
        next: newNext,
        context: { config, outputPath: newOutputPath },
      } = await app.run(context)
      next = newNext
      Object.assign(context.config, config)
      context.outputPath = newOutputPath
    } else break
  }
  return context
}
