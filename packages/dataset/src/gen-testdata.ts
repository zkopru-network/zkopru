import { getDummyBody } from './testset-block'

(async () => {
  await getDummyBody()
})().catch(e => {
  console.error(e)
})
