// eslint-disable-next-line @typescript-eslint/ban-ts-ignore
// @ts-ignore
import { doubleNumbers } from '@zkopru/common'

export const run = () => {
  const value = doubleNumbers([1, 2, 3])
  return value
}

console.log(run())
