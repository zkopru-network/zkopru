import { PromptApp } from '@zkopru/utils'
import { Coordinator } from '../coordinator'

export enum AppMenu {
  TOP_MENU,
  PRINT_STATUS,
  LAYER1_DETAIL,
  COORDINATOR_INFO,
  AUTO_COORDINATE,
  SETUP_MENU,
  REGISTER_VK,
  COMPLETE_SETUP,
  REGISTER_AS_COORDINATOR,
  DEREGISTER,
  EXIT,
}

export interface Context {
  menu: AppMenu
}

export default abstract class App extends PromptApp<Context, Coordinator> {
  coordinator: Coordinator

  constructor(coordinator: Coordinator, onCancel: () => Promise<void>) {
    super(coordinator, onCancel)
    this.coordinator = coordinator
  }
}
