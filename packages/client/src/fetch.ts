// https://github.com/typescript-eslint/typescript-eslint/issues/1436
// eslint-disable-next-line prettier/prettier
import type { RequestInfo, RequestInit, Response } from 'node-fetch'

export default ((...args) => {
  // eslint-disable-next-line global-require
  return typeof fetch === 'undefined' ?
    require('node-fetch')(...args) :
    (fetch as any)(...args)
}) as (url: RequestInfo, init?: RequestInit) => Promise<Response>
