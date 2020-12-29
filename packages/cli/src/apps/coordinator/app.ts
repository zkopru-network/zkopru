import { Coordinator } from '@zkopru/coordinator'
import { Dashboard } from '../../dashboard'
import { Context } from './prompts'
import TopMenu from './prompts/top-menus'
import CompleteSetup from './prompts/setup/complete-setup'
import RegisterAsCoordinator from './prompts/setup/register-as-coordinator'
import Deregister from './prompts/setup/deregister'
import AutoCoordinate from './prompts/auto-coordinate'
import PrintStatus from './prompts/print-status'
import SetupMenu from './prompts/setup-menus'
import Layer1Details from './prompts/layer1-details'
import CoordinatorInfo from './prompts/coordinator-info'
import AuctionInfo from './prompts/auction-info'
import CommitDeposits from './prompts/setup/commit-deposits'
import RegisterVk from './prompts/setup/register-vks'
import StopAutoCoordination from './prompts/stop-auto-coordinate'
import AuctionMenu from './prompts/auction-menu'
import UpdateUrl from './prompts/auction/update-url'
import UpdateMaxBid from './prompts/auction/update-max-bid'
import Refund from './prompts/auction/refund'

export class CoordinatorDashboard extends Dashboard<Context, Coordinator> {
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
    this.addPromptApp(
      StopAutoCoordination.code,
      new StopAutoCoordination(option),
    )
    this.addPromptApp(PrintStatus.code, new PrintStatus(option))
    this.addPromptApp(Layer1Details.code, new Layer1Details(option))
    this.addPromptApp(CoordinatorInfo.code, new CoordinatorInfo(option))
    this.addPromptApp(AuctionInfo.code, new AuctionInfo(option))
    this.addPromptApp(AuctionMenu.code, new AuctionMenu(option))
    this.addPromptApp(UpdateUrl.code, new UpdateUrl(option))
    this.addPromptApp(UpdateMaxBid.code, new UpdateMaxBid(option))
    this.addPromptApp(Refund.code, new Refund(option))
  }
}
