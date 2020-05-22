import { ZkWallet } from '../zk-wallet'
import { AppMenu, Context } from './app'
import TopMenu from './menus/top-menus'

export async function runCliApp(
  zkWallet: ZkWallet,
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
  menus[AppMenu.TOP_MENU] = new TopMenu(zkWallet, onCancel)
  while (context.menu !== AppMenu.EXIT) {
    const menu = menus[context.menu]
    if (menu) {
      context = await menu.run(context)
    } else {
      break
    }
  }
}
