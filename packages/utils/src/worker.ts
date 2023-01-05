import { EventEmitter } from 'events'
import { logger } from './logger'

export declare interface Worker<T> {
  on(event: 'data', listener: (result: T) => void): this
}
export type Task<T> = () => Promise<T>

export type PeriodicTask<T> = {
  task: Task<T>
  interval: number
  timeout?: number
}

function sleep(ms: number) {
  return new Promise(res => {
    setTimeout(res, ms)
  })
}

export class Worker<T> extends EventEmitter {
  private result?: T | null

  private keepRunning = false

  private job: Promise<void> | null = null

  isRunning(): boolean {
    return this.job !== null
  }

  start(task: PeriodicTask<T>) {
    const { timeout, interval } = task
    if (timeout && timeout > interval)
      throw Error('Timeout should be less than interval.')
    if (this.isRunning()) throw Error('Worker is already running.')
    else {
      this.keepRunning = true
      this.job = this.run(task)
    }
  }

  async stop() {
    this.keepRunning = false
    const currentTask = this.job
    if (currentTask) {
      this.job = null
      await currentTask
    }
  }

  async close() {
    await this.stop()
    this.removeAllListeners()
  }

  private isTurnedOn() {
    return this.keepRunning
  }

  private async run(task: PeriodicTask<T>) {
    while (this.isTurnedOn()) {
      this.result = null
      if (task.timeout) {
        setTimeout(this.detectDanglingTask, task.timeout)
      }
      try {
        await this.runTask(task.task)
      } catch (err) {
        logger.error('Uncaught error in task')
        logger.error(err as string)
      } finally {
        await sleep(task.interval)
      }
    }
  }

  private detectDanglingTask() {
    if (this.result === null) {
      throw Error(`Failed to run the job within.`)
    }
  }

  private async runTask(task: Task<T>) {
    const result = await task()
    this.result = result
    this.emit('data', result)
  }
}
