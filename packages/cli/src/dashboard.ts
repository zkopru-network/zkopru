/* eslint-disable import/no-extraneous-dependencies */
/* eslint-disable @typescript-eslint/camelcase */
import { logStream, logger, PromptApp } from '@zkopru/utils'
import blessed, { Widgets } from 'blessed'
import { Transform, Writable } from 'stream'
import prettier from 'pino-pretty'
import { AnsiTerminal } from 'node-ansiterminal'
import AnsiParser from 'node-ansiparser'
import { instruction } from './instruction'

export class Dashboard<T, B> {
  static START_CODE = -777

  static EXIT_CODE = -999

  code: number = Dashboard.START_CODE

  screen: Widgets.Screen

  logStream = logStream

  promptBox: Widgets.BoxElement

  infoBox: Widgets.BoxElement

  logBox: Widgets.Log

  statusBox: Widgets.BoxElement

  promptReadStream: Transform

  promptWriteStream: Writable

  printInfoStream: Writable

  prettier = prettier({
    translateTime: false,
    colorize: true,
  })

  apps: {
    [key: number]: PromptApp<T, unknown>
  }

  scrollMode = true

  context: T

  base: B

  constructor(context: T, base: B) {
    this.base = base
    this.context = context
    this.apps = {}
    process.stdin.removeAllListeners('data')
    this.screen = blessed.screen({
      smartCSR: true,
      dockBorders: true,
      warnings: true,
      input: process.stdin,
      output: process.stdout,
      fullUnicode: true,
    })
    this.promptBox = blessed.box({
      name: 'PromptBox',
      label: 'Prompt',
      left: 0,
      top: 0,
      width: '50%',
      height: '40%',
      border: {
        type: 'line',
        bold: '2',
      },
      cursor: 'line',
      cursorBlink: true,
      style: { border: { fg: 'cyan' } },
      focusable: true,
      clickable: true,
    })
    this.infoBox = blessed.box({
      name: 'InfoBox',
      label: 'Info',
      left: 0,
      top: '40%',
      width: '50%',
      height: '40%',
      border: 'line',
      mouse: true,
      scrollable: true,
      alwaysScroll: true,
      style: { border: { fg: 'cyan' } },
    })
    this.logBox = blessed.log({
      name: 'LogBox',
      right: '0',
      top: '0',
      label: 'Log',
      width: '50%',
      height: '80%',
      border: 'line',
      mouse: false,
      tags: true,
      vi: true,
      scrollback: 100,
      scrollable: true,
      focusable: true,
      alwaysScroll: true,
      style: { border: { fg: 'cyan', bold: true } },
      scrollbar: {
        ch: ' ',
        track: { bg: 'yellow ' },
        style: { inverse: true },
      },
      clickable: true,
    })
    this.statusBox = blessed.box({
      name: 'InstructionBox',
      label: 'Instruction',
      left: 0,
      bottom: 0,
      width: '100%',
      height: '20%',
      border: 'line',
      tags: true,
      vi: true,
      alwaysScroll: true,
      clickable: true,
      style: {
        header: {
          fg: 'blue',
          bold: true,
        },
        border: { fg: 'cyan', bold: '2' },
        cell: {
          fg: 'magenta',
          selected: {
            bg: 'blue',
          },
        },
      },
    })
    this.promptBox.focus()
    this.promptBox.on('click', () => this.promptBox.focus())
    this.logBox.on('click', () => this.logBox.focus())
    this.statusBox.on('click', () => this.statusBox.focus())
    this.statusBox.setContent(instruction)
    this.screen.append(this.promptBox)
    this.screen.append(this.logBox)
    this.screen.append(this.statusBox)
    this.screen.append(this.infoBox)
    this.logStream.addStream(
      new Writable({
        write: (chunk, _, cb) => {
          this.logBox.log(this.prettier(JSON.parse(chunk.toString())).trim())
          cb()
        },
      }),
    )
    const terminal = new AnsiTerminal(this.screen.cols, this.screen.rows, 500)
    terminal.newline_mode = true
    const parser = new AnsiParser(terminal)
    this.promptBox.on('resize', () => {
      terminal.resize(this.screen.cols, this.screen.rows)
    })
    const render = () => {
      this.promptBox.setContent(
        terminal.screen.buffer
          .map(tRow => tRow.toEscapeString({ rtrim: true }))
          .map(str => str.trimEnd())
          .join('\n'),
      )
      this.screen.render()
    }
    this.promptWriteStream = new Writable({
      write: (chunk, _, cb) => {
        if (chunk) {
          if (chunk.toString() !== '\u0007') {
            terminal.reset()
            terminal.newline_mode = true
          }
          parser.parse(chunk.toString())
          render()
          cb()
        }
      },
    })
    this.promptReadStream = new Transform({
      transform(chunk, encoding, callback) {
        this.push(chunk, encoding)
        callback()
      },
    })
    this.screen.on('keypress', (ch, key) => {
      if (key.name === 'escape') {
        if (this.scrollMode) {
          this.screen.program.disableMouse()
          this.scrollMode = false
        } else {
          this.screen.program.enableMouse()
          this.scrollMode = true
        }
      } else if (key.name === 'pageup') {
        this.logBox.scroll(
          (-parseInt(`${this.logBox.height}`, 10) / 4) | 0 || -1,
        )
        this.logBox.render()
      } else if (key.name === 'pagedown') {
        this.logBox.scroll((parseInt(`${this.logBox.height}`, 10) / 4) | 0 || 1)
        this.logBox.render()
      } else if (key.name !== 'return' && ch !== undefined) {
        this.promptReadStream.write(ch)
      }
      // TODO grace termination
      if (key.full === 'C-c') process.exit()
    })
    this.printInfoStream = new Writable({
      write: (chunk, _, cb) => {
        this.infoBox.setContent(chunk.toString())
        this.screen.render()
        cb()
      },
    })
  }

  addPromptApp(code: number, app: PromptApp<T, B>) {
    this.apps[code] = app
    app.setReadStream(this.promptReadStream)
    app.setWriteStream(this.promptWriteStream)
    app.setInfoStream(this.printInfoStream)
  }

  setContext(context: T) {
    this.context = context
  }

  async run(): Promise<void> {
    let code = await this.runPrompts(Dashboard.START_CODE)
    while (code !== Dashboard.EXIT_CODE) {
      code = await this.runPrompts(code)
    }
  }

  render() {
    this.screen.render()
  }

  private async runPrompts(code: number): Promise<number> {
    this.code = code
    const app = this.apps[code]
    this.promptBox.setContent('')
    if (app) {
      const { next, context } = await app.run(this.context)
      this.setContext(context)
      return next
    }
    logger.info('terminating app')
    return Dashboard.EXIT_CODE
  }
}
