import { describe, expect, test } from 'claude-code/testing'
import type { Engine } from 'claude-code/testing'
import type { On } from 'claude-code'

const ENGINE = 'engine band'

const TWO_OF_FIVE = [
  '# Tasks',
  '- [x] Write the spec',
  '- [X] Draft the plan',
  '  - [ ] Install blast-radius from the playground clone',
  '* [ ] Wire the band',
  '- [ ] Ship it',
  'Plain text and - [ ] not at line start do not count.',
].join('\n')

const ALL_DONE = ['- [x] one', '- [x] two', '  - [X] three'].join('\n')

const PROPS = (over: { hasSurvey?: boolean; bodyColumns?: number } = {}) => ({
  hasSurvey: false,
  isWorking: false,
  maxRows: 10,
  bodyColumns: 80,
  scroll: { offset: 0, bodyRows: 10 },
  view: {},
  ...over,
})

// The file system beneath the plugin (paths arrive resolved against the session's cwd): one file, TASKS.md, whose text the test may change.
function files(on: On, initial: string | undefined) {
  const disk = { text: initial }
  on('fs.read', ($, e, next) => {
    if (e.path.endsWith('/TASKS.md') && disk.text !== undefined) return { value: disk.text }

    return { deny: 'ENOENT' }
  })
  bottom(on)
  return disk
}

// What the engine answers beneath the plugin for the events the tests raise.
function bottom(on: On) {
  on('session.start', () => ({ cwd: '/work' }))
  on('turn.complete', () => ({ text: '' }))
  on('tool.call', () => ({ ref: 'r', result: 'ok', text: 'ok' }) as never)
  // The engine's own band, which the plugin yields to with next(e).
  on('ui.render', ($, e) => $.ui.resolve(e).Text({ children: ENGINE }))
}

async function start($: Engine) {
  await $.session.start({ cwd: '/work', surface: 'terminal', isInteractive: true })
}

async function bandText($: Engine, surface: 'terminal' | 'desktop', over = {}) {
  const ui = await $.ui.mount({
    plugin: 'tasks-band',
    surface,
    component: 'AbovePrompt',
    props: PROPS(over),
  })
  const texts = await ui.findAll({ type: 'Text' })
  await ui.unmount()

  const text = texts.map(t => t.text).join('')

  return text === ENGINE ? '' : text
}

for (const surface of ['terminal', 'desktop'] as const) {
  describe(`tasks-band on ${surface}`, () => {
    test('no file draws nothing', async ($, on) => {
      files(on, undefined)
      await start($)
      expect(await bandText($, surface)).toBe('')
    })

    test('a file with no checkbox items draws nothing', async ($, on) => {
      files(on, '# Notes\n- plain bullet\n')
      await start($)
      expect(await bandText($, surface)).toBe('')
    })

    test('2 of 5 done shows the count and the first open item', async ($, on) => {
      files(on, TWO_OF_FIVE)
      await start($)
      const text = await bandText($, surface)
      expect(text).toContain('TASKS 2/5')
      expect(text).toContain('▓▓░░░')
      expect(text).toContain('next: Install blast-radius from the playground clone')
    })

    test('all done shows 5/5 and no next', async ($, on) => {
      files(on, ALL_DONE + '\n- [x] four\n- [x] five')
      await start($)
      const text = await bandText($, surface)
      expect(text).toContain('TASKS 5/5')
      expect(text).toContain('▓▓▓▓▓')
      expect(text).not.toContain('next')
    })

    test('an Edit to TASKS.md refreshes the counts', async ($, on) => {
      const disk = files(on, TWO_OF_FIVE)
      await start($)
      expect(await bandText($, surface)).toContain('TASKS 2/5')

      disk.text = TWO_OF_FIVE.replace('- [ ] Ship it', '- [x] Ship it')
      await $.tool.call({
        tool: 'Edit',
        file_path: '/work/TASKS.md',
        old_string: '- [ ] Ship it',
        new_string: '- [x] Ship it',
      })
      expect(await bandText($, surface)).toContain('TASKS 3/5')
    })

    test('an Edit to another file leaves the counts alone', async ($, on) => {
      const disk = files(on, TWO_OF_FIVE)
      await start($)
      disk.text = ALL_DONE
      await $.tool.call({ tool: 'Edit', file_path: '/work/README.md', old_string: 'a', new_string: 'b' })
      expect(await bandText($, surface)).toContain('TASKS 2/5')
    })

    test('turn.complete in the main loop refreshes, a subagent turn does not', async ($, on) => {
      const disk = files(on, TWO_OF_FIVE)
      await start($)
      disk.text = ALL_DONE
      const turn = { answer: '', durationMs: 1, isAborted: false, turnId: 't', reason: 'answer' as const }
      await $.turn.complete({ ...turn, agentId: 'sub' })
      expect(await bandText($, surface)).toContain('TASKS 2/5')
      await $.turn.complete(turn)
      expect(await bandText($, surface)).toContain('TASKS 3/3')
    })

    test('hasSurvey yields to the engine', async ($, on) => {
      files(on, TWO_OF_FIVE)
      await start($)
      expect(await bandText($, surface, { hasSurvey: false })).toContain('TASKS 2/5')
      expect(await bandText($, surface, { hasSurvey: true })).toBe('')
    })

    test('a long next item is truncated to bodyColumns', async ($, on) => {
      files(on, '- [ ] ' + 'word '.repeat(60))
      await start($)
      const text = await bandText($, surface, { bodyColumns: 50 })
      // One column of padding each side.
      expect(text.length).toBeLessThanOrEqual(48)
      expect(text.endsWith('…')).toBe(true)
      expect(text).toContain('TASKS 0/1')
    })

    test('a state write redraws a band that stays mounted', async ($, on) => {
      const disk = files(on, TWO_OF_FIVE)
      await start($)
      const ui = await $.ui.mount({
        plugin: 'tasks-band',
        surface,
        component: 'AbovePrompt',
        props: PROPS(),
      })
      const read = async () => (await ui.findAll({ type: 'Text' })).map(t => t.text).join('')
      expect(await read()).toContain('TASKS 2/5')

      disk.text = TWO_OF_FIVE.replace('- [ ] Ship it', '- [x] Ship it')
      await $.turn.complete({ answer: '', durationMs: 1, isAborted: false, turnId: 't', reason: 'answer' })
      expect(await read()).toContain('TASKS 3/5')
      await ui.unmount()
    })

    test('a CRLF file counts like an LF one', async ($, on) => {
      files(on, TWO_OF_FIVE.replace(/\n/g, '\r\n'))
      await start($)
      const text = await bandText($, surface)
      expect(text).toContain('TASKS 2/5')
      expect(text).toContain('next: Install blast-radius from the playground clone')
    })

    test('numbered and plus items count; a link that starts with [x] does not', async ($, on) => {
      files(on, ['1. [x] one', '2) [ ] two', '+ [ ] three', '- [x](https://example.com) a link'].join('\n'))
      await start($)
      const text = await bandText($, surface)
      expect(text).toContain('TASKS 1/3')
      expect(text).toContain('next: two')
    })

    test('control characters in the text become spaces', async ($, on) => {
      files(on, '- [ ] bad\u0007text\u001b[0m\tend')
      await start($)
      const text = await bandText($, surface)
      expect(text).toContain('next: bad text [0m end')
      expect(/[\u0000-\u001f\u007f-\u009f]/.test(text)).toBe(false)
    })

    test('markdown marks are stripped from the next text', async ($, on) => {
      files(on, '- [ ] Read [the docs](https://example.com/a) and `run` **now** ~~later~~')
      await start($)
      expect(await bandText($, surface)).toContain('next: Read the docs and run now later')
    })

    test('an item with no text is never the next one', async ($, on) => {
      files(on, '- [ ]\n- [ ] real work')
      await start($)
      const text = await bandText($, surface)
      expect(text).toContain('TASKS 0/2')
      expect(text).toContain('next: real work')
    })

    test('a 20-column band does not overflow', async ($, on) => {
      files(on, '- [ ] ' + 'word '.repeat(20))
      await start($)
      const text = await bandText($, surface, { bodyColumns: 20 })
      expect(text).toContain('TASKS 0/1')
      expect(text.length).toBeLessThanOrEqual(18)
    })

    test('1/100 is not drawn empty and 99/100 is not drawn full', async ($, on) => {
      const list = (done: number) =>
        Array.from({ length: 100 }, (_, i) => `- [${i < done ? 'x' : ' '}] item ${i}`).join('\n')
      const disk = files(on, list(1))
      await start($)
      expect(await bandText($, surface)).toContain('TASKS 1/100 ▓░░░░░░░░░')
      disk.text = list(99)
      await $.session.start({ cwd: '/work', surface: 'terminal', isInteractive: true })
      expect(await bandText($, surface)).toContain('TASKS 99/100 ▓▓▓▓▓▓▓▓▓░')
    })

    test('the file option picks another name', { options: { file: 'TODO.md' } }, async ($, on) => {
      on('fs.read', ($, e, next) => {
        if (e.path.endsWith('/TODO.md')) return { value: '- [x] a\n- [ ] b' }

        return { deny: 'ENOENT' }
      })
      bottom(on)
      await start($)
      expect(await bandText($, surface)).toContain('TASKS 1/2')
    })
  })
}
