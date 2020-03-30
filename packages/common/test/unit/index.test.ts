import { doubleNumbers } from '~common'

describe('index', () => {
  it('doubleNumbers', () => {
    expect.hasAssertions()
    expect(doubleNumbers([1, 2, 3])).toStrictEqual([2, 4, 6])
    expect(doubleNumbers([6, 2, 13])).toStrictEqual([12, 4, 26])
  })
})
