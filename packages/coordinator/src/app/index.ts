import { Coordinator } from '../coordinator'
import { AppMenu, Context } from './app'
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

export async function runCliApp(
  coordinator: Coordinator,
  onError?: () => Promise<void>,
): Promise<void> {
  const defaultOnCancel = () => {
    process.exit()
  }
  const onCancel = onError || defaultOnCancel
  let context: Context = {
    menu: AppMenu.TOP_MENU,
  }
  const menus = {}
  menus[TopMenu.code] = new TopMenu(coordinator, onCancel)
  menus[SetupMenu.code] = new SetupMenu(coordinator, onCancel)
  menus[RegisterVk.code] = new RegisterVk(coordinator, onCancel)
  menus[CompleteSetup.code] = new CompleteSetup(coordinator, onCancel)
  menus[RegisterAsCoordinator.code] = new RegisterAsCoordinator(
    coordinator,
    onCancel,
  )
  menus[AutoCoordinate.code] = new AutoCoordinate(coordinator, onCancel)
  menus[Deregister.code] = new Deregister(coordinator, onCancel)
  menus[PrintStatus.code] = new PrintStatus(coordinator, onCancel)
  menus[Layer1Details.code] = new Layer1Details(coordinator, onCancel)
  menus[CoordinatorInfo.code] = new CoordinatorInfo(coordinator, onCancel)
  while (context.menu !== AppMenu.EXIT) {
    const menu = menus[context.menu]
    if (menu) {
      context = await menu.run(context)
    } else {
      break
    }
  }
}
