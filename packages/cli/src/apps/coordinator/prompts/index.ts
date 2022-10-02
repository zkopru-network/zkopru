import { PromptApp } from '@zkopru/utils'
import { Coordinator } from '@zkopru/coordinator'
import { DashboardCode } from '../../../dashboard-code'

export enum AppMenu {
  PRINT_STATUS,
  LAYER1_DETAIL,
  AUCTION_INFO,
  AUCTION_MENU,
  AUCTION_REFUND,
  AUCTION_UPDATE_URL,
  AUCTION_UPDATE_MAX_BID,
  COORDINATOR_INFO,
  AUTO_COORDINATE,
  STOP_AUTO_COORDINATION,
  SETUP_MENU,
  REGISTER_VK,
  COMPLETE_SETUP,
  REGISTER_AS_COORDINATOR,
  DEREGISTER,
  COMMIT_DEPOSITS,
  TOP_MENU = DashboardCode.START_CODE,
  EXIT = DashboardCode.EXIT_CODE,
}

export interface Context {
  temp?: number
}

export default abstract class App extends PromptApp<Context, Coordinator> {}
