import { PromptApp, makePathAbsolute } from '@zkopru/utils'
import path from 'path'
import { Menu, ExampleConfigContext } from '../menu'

export default class OutputPath extends PromptApp<ExampleConfigContext, void> {
  static code = Menu.OUTPUT_PATH

  async run(
    context: ExampleConfigContext,
  ): Promise<{ context: ExampleConfigContext; next: number }> {
    const { outputPath } = await this.ask({
      type: 'text',
      name: 'outputPath',
      message: `Where should this config be written?`,
      initial: path.relative(
        process.cwd(),
        makePathAbsolute(context.outputPath),
      ),
    })
    return {
      context: {
        ...context,
        outputPath: makePathAbsolute(outputPath),
      },
      next: Menu.COMPLETE,
    }
  }
}
