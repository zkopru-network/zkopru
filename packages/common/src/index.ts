/* The module name can be just './hello'.
But '~foo/hello' is demonstration of "path mapping" of `tsconfig`
and "module alias" of `link-module-alias` */
import { hello } from '~common/hello'
// import { hello } from './hello' => this will work, too
// import { hello } from '@jjangga0214/foo/hello' // => this will not work, without additional configuration on tsconfig.json

hello('world')

export const doubleNumbers = (data: number[]) => {
  return data.map(i => i * 2)
}
