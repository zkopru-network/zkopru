import AsyncLock from 'async-lock'
import { Store } from './store'

export class MemStore implements Store {
  s1Lock: AsyncLock

  s2Lock: AsyncLock

  s1: {
    [key: string]: Buffer
  }

  s2: {
    [key: string]: Buffer[]
  }

  constructor() {
    this.s1 = {}
    this.s2 = {}
    this.s1Lock = new AsyncLock()
    this.s2Lock = new AsyncLock()
  }

  async get(key: Buffer): Promise<Buffer> {
    const k = key.toString()
    return new Promise<Buffer>(resolve => {
      this.s1Lock.acquire(k, async () => {
        const val = this.s1[k]
        resolve(val)
      })
    })
  }

  async put(key: Buffer, value: Buffer): Promise<void> {
    const k = key.toString()
    return new Promise<void>(resolve => {
      this.s1Lock.acquire(k, async () => {
        this.s1[key.toString()] = value
        resolve()
      })
    })
  }

  async del(key: Buffer): Promise<void> {
    const k = key.toString()
    return new Promise<void>(resolve => {
      this.s1Lock.acquire(k, async () => {
        delete this.s1[key.toString()]
        resolve()
      })
    })
  }

  async batchPut(items: { key: Buffer; value: Buffer }[]): Promise<void> {
    const keys = items.map(item => item.key.toString())
    return new Promise<void>(resolve => {
      this.s1Lock.acquire(keys, async () => {
        items.forEach(item => {
          this.s1[item.key.toString()] = item.value
        })
        resolve()
      })
    })
  }

  async getList(key: Buffer): Promise<Buffer[]> {
    const k = key.toString()
    return new Promise<Buffer[]>(resolve => {
      this.s2Lock.acquire(k, async () => {
        const val = this.s2[k]
        if (val) resolve(val)
        else resolve([])
      })
    })
  }

  async pushToList(key: Buffer, value: Buffer): Promise<void> {
    const k = key.toString()
    return new Promise<void>(resolve => {
      this.s2Lock.acquire(k, async () => {
        if (!this.s2[k]) this.s2[k] = []
        this.s2[k].push(value)
        resolve()
      })
    })
  }

  async batchPush(items: { key: Buffer; value: Buffer }[]): Promise<void> {
    const keys = items.map(item => item.key.toString())
    return new Promise<void>(resolve => {
      this.s2Lock.acquire(keys, async () => {
        items.forEach(item => {
          const key = item.key.toString()
          if (!this.s2[key]) this.s2[key] = []
          this.s2[key].push(item.value)
        })
        resolve()
      })
    })
  }
}
