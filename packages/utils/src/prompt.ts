/* eslint-disable @typescript-eslint/no-unused-vars */
import prompts, { PromptObject } from 'prompts'
import { Readable, Writable } from 'stream'

export abstract class PromptApp<T, C> {
  base: C

  onCancel: () => Promise<void>

  readStream?: Readable

  writeStream?: Writable

  infoStream?: Writable

  constructor(option: {
    base: C
    onCancel: () => Promise<void>
    readStream?: Readable
    writeStream?: Writable
    infoStream?: Writable
  }) {
    this.base = option.base
    this.onCancel = option.onCancel
    this.readStream = option.readStream
    this.writeStream = option.writeStream
    this.infoStream = option.infoStream
  }

  setReadStream(read: Readable) {
    this.readStream = read
  }

  setWriteStream(write: Writable) {
    this.writeStream = write
  }

  setInfoStream(write: Writable) {
    this.infoStream = write
  }

  async ask<Q extends string = string>(
    questions: prompts.PromptObject<Q> | Array<prompts.PromptObject<Q>>,
    predefined?: prompts.Answers<Q>,
  ): Promise<prompts.Answers<Q>> {
    if (predefined) return predefined
    const option: prompts.Options = {
      onCancel: async () => {
        await this.onCancel()
      },
    }
    const promptObj: PromptObject = ({
      ...questions,
      stdin: this.readStream || process.stdin,
      stdout: this.writeStream || process.stdout,
    } as unknown) as PromptObject
    const answer = await prompts(promptObj, option)
    return answer
  }

  print(str: string) {
    if (this.infoStream) {
      this.infoStream.write(str)
    }
  }

  abstract run(context: T): Promise<{ context: T; next: number }>
}
