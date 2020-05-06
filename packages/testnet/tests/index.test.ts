import { getDummyBody } from '../src/testset-block'

describe('index', () => {
  it('run', async () => {
    const body = await getDummyBody()
    expect(body).toBeDefined()
  }, 1200000)
})
