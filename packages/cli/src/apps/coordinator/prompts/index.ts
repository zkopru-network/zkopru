import { PromptApp } from '@zkopru/utils'
import { Coordinator } from '@zkopru/coordinator'
import { Dashboard } from '../../../dashboard'

export enum AppMenu {
  PRINT_STATUS,
  LAYER1_DETAIL,
  AUCTION_INFO,
  AUCTION_MENU,
  UPDATE_URL,
  UPDATE_MAX_BID,
  COORDINATOR_INFO,
  AUTO_COORDINATE,
  STOP_AUTO_COORDINATION,
  SETUP_MENU,
  REGISTER_VK,
  COMPLETE_SETUP,
  REGISTER_AS_COORDINATOR,
  DEREGISTER,
  COMMIT_DEPOSITS,
  TOP_MENU = Dashboard.START_CODE,
  EXIT = Dashboard.EXIT_CODE,
}

export interface Context {
  temp?: number
}

export default abstract class App extends PromptApp<Context, Coordinator> {}
