// https://github.com/typescript-eslint/typescript-eslint/issues/1436
// eslint-disable-next-line prettier/prettier
import type { RequestInfo, RequestInit, Response } from 'node-fetch'

export default ((...args) => {
  return typeof fetch === 'undefined' ?
    // eslint-disable-next-line global-require, @typescript-eslint/no-var-requires
    require('node-fetch')(...args) :
    // eslint-disable-next-line no-undef
    (fetch as any)(...args)
}) as (url: RequestInfo, init?: RequestInit) => Promise<Response>
