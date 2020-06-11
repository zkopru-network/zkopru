import { Dashboard } from '../dashboard'
import { Coordinator } from '../coordinator'
import { Context } from './app'
import TopMenu from './menus/top-menus'
import RegisterVk from './menus/setup/register-vks'
import CompleteSetup from './menus/setup/complete-setup'
import RegisterAsCoordinator from './menus/setup/register-as-coordinator'
import Deregister from './menus/setup/deregister'
import AutoCoordinate from './menus/auto-coordinate'
import PrintStatus from './menus/print-status'
import SetupMenu from './menus/setup-menus'
import Layer1Details from './menus/layer1-details'
import CoordinatorInfo from './menus/coordinator-info'
import CommitDeposits from './menus/setup/commit-deposits'

export class CooridnatorDashboard extends Dashboard<Context, Coordinator> {
  constructor(coordinator: Coordinator, onCancel: () => Promise<void>) {
    super({}, coordinator)
    const option = {
      base: coordinator,
      onCancel,
    }
    this.addPromptApp(TopMenu.code, new TopMenu(option))
    this.addPromptApp(SetupMenu.code, new SetupMenu(option))
    this.addPromptApp(RegisterVk.code, new RegisterVk(option))
    this.addPromptApp(CompleteSetup.code, new CompleteSetup(option))
    this.addPromptApp(CommitDeposits.code, new CommitDeposits(option))
    this.addPromptApp(
      RegisterAsCoordinator.code,
      new RegisterAsCoordinator(option),
    )
    this.addPromptApp(Deregister.code, new Deregister(option))
    this.addPromptApp(AutoCoordinate.code, new AutoCoordinate(option))
    this.addPromptApp(PrintStatus.code, new PrintStatus(option))
    this.addPromptApp(Layer1Details.code, new Layer1Details(option))
    this.addPromptApp(CoordinatorInfo.code, new CoordinatorInfo(option))
  }
}
