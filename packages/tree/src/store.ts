export interface Store {
  get(key: Buffer): Promise<Buffer>
  put(key: Buffer, value: Buffer): Promise<void>
  del(key: Buffer): Promise<void>
  batchPut(items: Array<{ key: Buffer; value: Buffer }>): Promise<void>
  getList(key: Buffer): Promise<Buffer[]>
  pushToList(key: Buffer, value: Buffer): Promise<void>
  batchPush(items: Array<{ key: Buffer; value: Buffer }>): Promise<void>
}

export class CachedStore {
  store: Store

  cache: { [key: string]: Buffer }

  listCache: { [key: string]: Buffer[] }

  constructor(store: Store) {
    this.store = store
    this.cache = {}
    this.listCache = {}
  }

  async get(key: Buffer, option?: { skipCache: boolean }): Promise<Buffer> {
    const k = key.toString()
    if (!option?.skipCache) {
      if (!this.cache[k]) {
        this.cache[k] = await this.store.get(key)
      }
      return this.cache[k]
    }
    const val = await this.store.get(key)
    if (this.cache[k]) this.cache[k] = val
    return val
  }

  async getList(key: Buffer): Promise<Buffer[]> {
    const k = key.toString()
    if (!this.listCache[k]) {
      this.listCache[k] = await this.store.getList(key)
    }
    return this.listCache[k].map(Buffer.from)
  }

  async put(
    { key, value }: { key: Buffer; value: Buffer },
    batch?: Array<{ key: Buffer; value: Buffer }>,
    option?: {
      skipCache: boolean
    },
  ) {
    if (option === undefined || !option.skipCache) {
      this.cache[key.toString()] = value
    }
    if (batch) {
      batch.push({ key, value })
    } else {
      await this.store.put(key, value)
    }
  }

  async pushToList(
    { key, value }: { key: Buffer; value: Buffer },
    batch?: Array<{ key: Buffer; value: Buffer }>,
  ) {
    const k = key.toString()
    if (this.listCache[k]) {
      this.listCache[k] = await this.store.getList(key)
    }
    if (batch) {
      batch.push({ key, value })
    } else {
      await this.store.pushToList(key, value)
    }
  }

  async batchPut(batchJob: Array<{ key: Buffer; value: Buffer }>) {
    await this.store.batchPut(batchJob)
  }

  async batchForList(batchJob: Array<{ key: Buffer; value: Buffer }>) {
    await this.store.batchPush(batchJob)
  }
}
