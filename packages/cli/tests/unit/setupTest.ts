import { initContext, Context as NodeContext, terminate } from '../context'

let ctx: NodeContext
beforeAll(async () => {
  ctx = await initContext()
})
afterAll(async () => {
  terminate(() => ctx)
})

export async function getCtx() {
  if (ctx == undefined) {
    console.log('initContext')
    ctx = await initContext()
  }
  return ctx
}
