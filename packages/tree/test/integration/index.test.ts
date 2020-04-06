import { Field } from '@zkopru/core'

describe('integration test', () => {
  it('field', () => {
    expect.hasAssertions()
    expect(Field.from(1)).toBeDefined()
  })
})
