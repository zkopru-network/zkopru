import { logger } from '@zkopru/utils'
import App, { AppMenu, Context } from '..'

export default class CompleteSetup extends App {
  static code = AppMenu.COMPLETE_SETUP

  // eslint-disable-next-line class-methods-use-this
  async run(context: Context): Promise<{ context: Context; next: number }> {
    logger.info('Sending setup complete request')
    try {
      const receipt = await this.base.completeSetup()
      logger.info('Receipt', receipt)
    } catch (err) {
      logger.error(err as any)
    }
    return { context, next: AppMenu.SETUP_MENU }
  }
}
