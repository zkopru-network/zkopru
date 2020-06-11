import { Coordinator } from '../coordinator'
import { Dashboard } from '../dashboard'
import { PromptApp } from '../prompt'

export enum AppMenu {
  PRINT_STATUS,
  LAYER1_DETAIL,
  COORDINATOR_INFO,
  AUTO_COORDINATE,
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
