import { Field } from '@zkopru/commons'

describe('integration test', () => {
  it('field', () => {
    expect.hasAssertions()
    expect(Field.from(1)).toBeDefined()
  })
})
