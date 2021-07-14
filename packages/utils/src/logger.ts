/* eslint-disable @typescript-eslint/no-explicit-any */
import pino from 'pino'
import prettier from 'pino-pretty'
import { Writable } from 'stream'

export class StreamConcatenator extends Writable {
  streams: Writable[]

  constructor() {
    super()
    this.streams = []
  }

  // eslint-disable-next-line no-underscore-dangle
  _write(
    chunk: any,
    encoding: BufferEncoding,
    callback: (error?: Error | null | undefined) => void,
  ): void {
    for (const stream of this.streams) {
      stream.write(chunk, encoding)
    }
    callback()
  }

  addStream(stream: Writable) {
    this.streams.push(stream)
  }

  removeStream(stream: Writable) {
    const index = this.streams.indexOf(stream)
    if (index > -1) this.streams.splice(index, 1)
  }
}

export const logStream = new StreamConcatenator()
export const logger = pino(
  {
    level:
      process.env.LOG_LEVEL ||
      (process.env.DEBUG === 'true' ? 'debug' : 'info'),
  },
  logStream,
)

const pinoPrettier = prettier({
  translateTime: false,
  colorize: true,
})

export const attachConsoleLogToPino = () => {
  logStream.addStream(
    new Writable({
      write: (chunk, _, cb) => {
        const log = JSON.parse(chunk.toString())
        console.log(pinoPrettier(log).trim())
        cb()
      },
    }),
  )
}
export const attachConsoleErrorToPino = () => {
  logStream.addStream(
    new Writable({
      write: (chunk, _, cb) => {
        const log = JSON.parse(chunk.toString())
        if (log.level >= 50) {
          // error: 50, info: 30
          console.error(pinoPrettier(log).trim())
        }
        cb()
      },
    }),
  )
}

if (process.env.PRINT_LOG) {
  attachConsoleLogToPino()
}
