import { TransactionReceipt } from '@ethersproject/providers'
import { logger } from '@zkopru/utils'
import App, { AppMenu, Context } from '..'

export default class CommitDeposits extends App {
  static code = AppMenu.COMMIT_DEPOSITS

  async run(context: Context): Promise<{ context: Context; next: number }> {
    logger.info('Mannual finalization')
    let receipt: TransactionReceipt | undefined
    try {
      receipt = await this.base.commitMassDeposits()
    } catch (err) {
      logger.error(err as any)
    } finally {
      if (receipt && receipt.status) {
        logger.info('Successfully committed the latest mass deposit')
      } else {
        logger.error('Failed to commit the latest mass deposit')
      }
    }
    return { context, next: AppMenu.SETUP_MENU }
  }
}
