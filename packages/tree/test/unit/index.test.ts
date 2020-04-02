import { Field } from '@zkopru/commons'

describe('unit test', () => {
  it('field', () => {
    expect.hasAssertions()
    expect(Field.from(1)).toStrictEqual(1)
  })
})
