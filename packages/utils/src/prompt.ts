import prompts from 'prompts'

export abstract class PromptApp<T, C> {
  config: C

  onCancel: () => Promise<void>

  constructor(config: C, onCancel: () => Promise<void>) {
    this.config = config
    this.onCancel = onCancel
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
    const answer = await prompts(questions, option)
    return answer
  }

  abstract async run(context: T): Promise<T>

  static goTo<T, M>(context: T, menu: M): T {
    return Object.assign(context, { menu })
  }

  static print(chalk?: (...text: string[]) => string) {
    return (...str: unknown[]) => {
      if (chalk) {
        console.log(chalk(...(str as string[])))
      } else {
        console.log(...str)
      }
    }
  }
}
