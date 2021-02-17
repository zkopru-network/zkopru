// eslint-disable-next-line prettier/prettier
import type { RequestInfo, RequestInit, Response } from 'node-fetch'

// This is a global in browser and webworker contexts
let fetch: any

if (typeof fetch === 'undefined') {
  // eslint-disable-next-line global-require
  fetch = require('node-fetch')
}

export default fetch as (url: RequestInfo, init?: RequestInit) => Promise<Response>
