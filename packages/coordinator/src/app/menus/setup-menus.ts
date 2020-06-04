import App, { AppMenu, Context } from '../app'

const { goTo } = App

export default class SetupMenu extends App {
  static code = AppMenu.SETUP_MENU

  // eslint-disable-next-line class-methods-use-this
  async run(context: Context): Promise<Context> {
    const { code } = await this.ask({
      type: 'select',
      name: 'code',
      message: 'Select menu',
      choices: [
        {
          title: '..',
          value: AppMenu.TOP_MENU,
        },
        {
          title: 'Register as a coordinator',
          value: AppMenu.REGISTER_AS_COORDINATOR,
        },
        {
          title: 'Commit the latest deposits',
          value: AppMenu.COMMIT_DEPOSITS,
        },
        {
          title: 'Deregister',
          value: AppMenu.DEREGISTER,
        },
        {
          title: 'Complete setup',
          value: AppMenu.COMPLETE_SETUP,
        },
        {
          title: 'RegisterVk',
          value: AppMenu.REGISTER_VK,
        },
      ],
    })
    switch (code) {
      default:
        return {
          ...goTo(context, code),
        }
    }
  }
}
