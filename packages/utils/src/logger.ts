/* eslint-disable @typescript-eslint/no-explicit-any */
import pino from 'pino'
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
export const logger = pino({ level: 'trace' }, logStream)
