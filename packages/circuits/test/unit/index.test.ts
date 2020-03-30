import { run } from '~circuits'

describe('index', () => {
  it('run', () => {
    expect.hasAssertions()
    expect(run()).toStrictEqual([2, 4, 6])
  })
})
