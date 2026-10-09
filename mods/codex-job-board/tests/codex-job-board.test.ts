import { expect, mock, test } from 'claude-code/testing'
import type { Engine } from 'claude-code/testing'
import type { On } from 'claude-code'

import type { CodexJob } from '../types'

const T0 = Date.parse('2026-10-08T10:40:00.000Z')
const HOME = '/home/tester'
const SESSIONS = `${HOME}/.codex/sessions`
const FOLDER = `${SESSIONS}/2026/10/08`
const CODEX = {
  command: 'codex',
  args: '',
  origin: { kind: 'composer' },
  presentation: { isFullscreen: true, columns: 160 },
} as const
const PANE = {
  plugin: 'codex-job-board',
  component: 'Pane',
  requestId: 'codex-jobs',
  props: {
    title: 'Codex jobs',
    isFocused: false,
    bodyColumns: 100,
    placement: 'dock',
    scroll: { offset: 0, bodyRows: 20 },
    view: {},
  },
} as const
const START = { cwd: '/work', surface: 'terminal', isInteractive: true } as const
const ASTRA = `codex exec -m gpt-6-astra -c model_reasoning_effort='"xhigh"' -s read-only -C /work --color never -o out/report.md - < prompt.md`

const uid = (n: number) => `01a11b19-d139-76d1-8284-${String(n).padStart(12, '0')}`
const iso = (ms: number) => new Date(ms).toISOString()
const tokens = (total: number, last: number, window = 258_400) => ({
  type: 'token_count',
  info: { total_token_usage: { total_tokens: total }, last_token_usage: { total_tokens: last }, model_context_window: window },
})

type File = { lines: string[]; mtimeMs: number }

/** A disk of Codex files, read the way the mod reads them. */
class Disk {
  files = new Map<string, File>()
  dirs = new Map<string, string>([['/work', '/work'], ['/work/sub', '/work/sub'], ['/other', '/other']])

  /** A rollout created at `at` by `codex exec` in `/work`, unless told otherwise. */
  rollout(n: number, at: number, opts: { originator?: string; cwd?: string; model?: string } = {}) {
    const id = uid(n)
    const path = `${FOLDER}/rollout-2026-10-08T06-40-00-${id}.jsonl`
    const meta = { timestamp: iso(at), type: 'session_meta', payload: { id, timestamp: iso(at), cwd: opts.cwd ?? '/work', originator: opts.originator ?? 'codex_exec' } }
    const turn = { timestamp: iso(at), type: 'turn_context', payload: { cwd: opts.cwd ?? '/work', model: opts.model ?? 'gpt-6-astra' } }
    this.files.set(path, { lines: [JSON.stringify(meta), JSON.stringify(turn)], mtimeMs: at })
    return path
  }

  event(path: string, at: number, payload: object) {
    const file = this.files.get(path)
    if (file === undefined) throw new Error(`no ${path}`)
    file.lines.push(JSON.stringify({ timestamp: iso(at), type: 'event_msg', payload }))
    file.mtimeMs = at
  }
}

type World = { disk: Disk; isAlive: boolean; slowMs: number; toolResult: object; isRefused: boolean }

/** Everything beneath the plugin: Codex's files, the processes, the Bash tool, the screen. */
function world(on: On, set: Partial<World> = {}) {
  const w: World = { disk: new Disk(), isAlive: true, slowMs: 0, toolResult: {}, isRefused: false, ...set }
  const clock = mock.clock(on, { now: T0 })
  mock.env(on, { HOME })
  const statuses: (string | undefined)[] = []
  const opened: string[] = []
  const seen: { jobs: readonly CodexJob[] } = { jobs: [] }
  on('state.set', { plugin: 'codex-job-board', key: 'jobs' }, ($, e, next) => {
    seen.jobs = e.value as readonly CodexJob[]
    return next(e)
  })
  on('session.start', ($, e) => ({ cwd: e.cwd }))
  on('session.cwd', () => ({ value: '/work' }))
  on('command.register', ($, e) => ({ value: { command: e.name } }))
  on('ui.status', ($, e) => {
    statuses.push(e.text)
    return { value: undefined }
  })
  on('ui.open', ($, e) => {
    opened.push(e.id)
    return { value: { isPlaced: true } }
  })
  on('ui.close', () => ({ value: undefined }))
  on('fs.list', ($, e) => ({
    value: [...w.disk.files.entries()]
      .filter(([path]) => path.slice(0, path.lastIndexOf('/')) === e.path)
      .map(([path, file]) => ({ name: path.slice(path.lastIndexOf('/') + 1), kind: 'file' as const, size: 1, mtimeMs: file.mtimeMs, isLink: false })),
  }))
  on('fs.stat', ($, e) => {
    const file = w.disk.files.get(e.path)
    if (file !== undefined) return { value: { kind: 'file', size: 1, mtimeMs: file.mtimeMs, isLink: false } }
    const real = w.disk.dirs.get(e.path)
    if (real !== undefined) return { value: { kind: 'dir', size: 0, mtimeMs: 0, isLink: false, ...(e.resolve ? { realPath: real } : {}) } }
    return { deny: `ENOENT: ${e.path}` }
  })
  on('process.run', ($, e) => {
    const out = (stdout: string, exitCode = 0) => ({ value: { exitCode, stdout, stderr: '', isStdoutTruncated: false, isStderrTruncated: false } })
    const argv = [...e.argv]
    const [cmd] = argv
    if (cmd === 'pgrep') return w.isAlive ? out('123\n') : out('', 1)
    if (cmd === 'find') {
      const [, root = '', , pattern = ''] = argv
      const name = new RegExp(`^${pattern.replace(/[.]/g, '\\.').replace(/\*/g, '.*')}$`)
      const minutes = argv[4] === '-mmin' ? Number(argv[5]?.slice(1)) : undefined
      const found = [...w.disk.files.entries()].filter(([path, file]) =>
        path.startsWith(`${root}/`) && name.test(path.slice(path.lastIndexOf('/') + 1)) &&
        (minutes === undefined || file.mtimeMs >= clock.now() - minutes * 60_000))
      return out(found.map(([path]) => `${path}\n`).join(''))
    }
    const path = argv.at(-1) ?? ''
    const file = w.disk.files.get(path)
    if (file === undefined) return out('', 2)
    if (cmd === 'head') return out(`${file.lines[0] ?? ''}\n`)
    if (cmd === 'grep') {
      const isFirst = argv[1] === '-m'
      const pattern = new RegExp(argv.at(-2) ?? '')
      const hits = file.lines.filter(line => pattern.test(line)).slice(0, isFirst ? 1 : undefined)
      return hits.length === 0 ? out('', 1) : out(`${hits.join('\n')}\n`)
    }
    return out('', 1)
  })
  on('tool.call', { tool: 'Bash' }, async () => {
    if (w.slowMs > 0) await clock.sleep(w.slowMs)
    if (w.isRefused) return { isError: true as const, result: 'The user doesn\'t want to proceed with this tool use.' }
    return { result: { stdout: '', stderr: '', interrupted: false, ...w.toolResult } }
  })
  return { w, clock, statuses, opened, seen }
}

/** Runs a Bash call in the background. */
async function background($: Engine, command: string) {
  await $.tool.call({ tool: 'Bash', command, run_in_background: true })
}

test('a codex exec call records a job and the status line shows it', async ($, on) => {
  const { clock, statuses, seen } = world(on)
  await $.session.start(START)
  await background($, ASTRA)
  await clock.settle()

  expect(seen.jobs.length).toBe(1)
  const job = seen.jobs[0]
  expect(job?.model).toBe('gpt-6-astra')
  expect(job?.reportPath).toBe('out/report.md')
  expect(job?.reportFile).toBe('/work/out/report.md')
  expect(job?.codexCwd).toBe('/work')
  expect(job?.isBackground).toBe(true)
  expect(job?.status).toBe('running')
  expect(statuses.at(-1)).toBe('codex 1 running 0s')
})

test('Bash calls that are not codex exec record nothing', async ($, on) => {
  const { clock, statuses, seen } = world(on)
  await $.session.start(START)
  for (const command of [
    'ls -la',
    'grep -n "codex exec" CLAUDE.md',
    'echo "a; codex exec b"',
    "git commit -m '(codex exec later)'",
    "cat <<'EOF' > notes.md\nfirst line\ncodex exec -m gpt-6-astra - < p.md\nEOF\necho done",
    'cat <<-EOF\n\tcodex exec x\n\tEOF',
    'codex exec-server --remote x',
    'codexify exec',
  ]) {
    await $.tool.call({ tool: 'Bash', command })
  }
  await clock.settle()
  expect(seen.jobs.length).toBe(0)
  expect(statuses.filter(text => text !== undefined)).toEqual([])
})

test('codex exec after then, env -u, sudo, a path or a cd is a job', async ($, on) => {
  const { clock, seen } = world(on)
  await background($, 'if true; then codex exec -m m1 "x"; fi')
  await background($, 'env -u OPENAI_LOG codex exec -m m2 "x"')
  await background($, 'sudo /opt/homebrew/bin/codex exec -m m3 "x"')
  await background($, 'cd sub && codex exec -m m4 -o r.md "x"')
  await background($, "cat <<'EOF' > p.md\nhello\nEOF\ncodex exec -m m5 - < p.md")
  await clock.settle()
  expect(seen.jobs.map(job => job.model)).toEqual(['m1', 'm2', 'm3', 'm4', 'm5'])
  expect(seen.jobs[3]?.codexCwd).toBe('/work/sub')
  expect(seen.jobs[3]?.reportFile).toBe('/work/sub/r.md')
})

test('a 200 KB command is judged quickly', async ($, on) => {
  const { seen } = world(on)
  const began = Date.now()
  await $.tool.call({ tool: 'Bash', command: `echo ${'('.repeat(200_000)} codex` })
  await $.tool.call({ tool: 'Bash', command: `${'a=b '.repeat(50_000)}codex` })
  await $.tool.call({ tool: 'Bash', command: `${'; '.repeat(100_000)}codex ex` })
  expect(Date.now() - began).toBeLessThan(2_000)
  expect(seen.jobs.length).toBe(0)
})

test('a resume call carries the session id', async ($, on) => {
  const { clock, seen } = world(on)
  await background($, `cd /work && /usr/local/bin/codex exec resume ${uid(1)} -o r.md - < next.md`)
  await clock.settle()
  expect(seen.jobs[0]?.resumeId).toBe(uid(1))
  expect(seen.jobs[0]?.reportPath).toBe('r.md')
})

test('token_count gives total tokens, context percent, and task_complete done', async ($, on) => {
  const { w, clock, statuses, opened, seen } = world(on)
  await $.session.start(START)
  await background($, ASTRA)
  const path = w.disk.rollout(1, T0 + 1_000)
  w.disk.event(path, T0 + 2_000, { type: 'task_started' })
  w.disk.event(path, T0 + 60_000, { type: 'token_count', info: null })
  w.disk.event(path, T0 + 200_000, tokens(500_000, 90_000))
  w.disk.event(path, T0 + 246_000, tokens(734_505, 109_573))
  w.disk.event(path, T0 + 246_500, { type: 'task_complete' })
  await clock.advance(10_000)

  const job = seen.jobs[0]
  expect(job?.status).toBe('done')
  expect(job?.sessionId).toBe(uid(1))
  expect(job?.totalTokens).toBe(734_505)
  expect(job?.contextTokens).toBe(109_573)
  expect(job?.contextWindow).toBe(258_400)
  expect(statuses.at(-1)).toBeUndefined()
  expect(opened).toEqual(['codex-jobs'])

  expect((await $.command.run(CODEX)).text).toContain(`${uid(1)}: done, 734505 tokens, context 42%, report out/report.md`)
  const ui = await $.ui.mount({ ...PANE, surface: 'terminal' })
  expect(await ui.find({ type: 'Text', text: /00000001 +gpt-6-astra +4m +done +734\.5K +42%/ })).toBeDefined()
})

test('a resume of a finished job finds the same file and its own end', async ($, on) => {
  const { w, clock, seen } = world(on)
  await background($, ASTRA)
  const path = w.disk.rollout(1, T0 + 1_000)
  w.disk.event(path, T0 + 2_000, { type: 'task_started' })
  w.disk.event(path, T0 + 5_000, { type: 'task_complete' })
  await clock.advance(10_000)
  expect(seen.jobs[0]?.status).toBe('done')

  await clock.advance(60_000)
  await background($, `codex exec resume ${uid(1)} -o out/second.md - < next.md`)
  await clock.advance(10_000)
  expect(seen.jobs[1]?.rolloutPath).toBe(path)
  expect(seen.jobs[1]?.status).toBe('running')
  w.disk.event(path, T0 + 90_000, { type: 'task_started' })
  w.disk.event(path, T0 + 95_000, { type: 'task_complete' })
  await clock.advance(10_000)
  expect(seen.jobs[1]?.status).toBe('done')
  expect(seen.jobs[0]?.status).toBe('done')
})

test('resume --last takes the latest file created before the call and written since', async ($, on) => {
  const { w, clock, seen } = world(on)
  const older = w.disk.rollout(1, T0 - 7_200_000)
  const latest = w.disk.rollout(2, T0 - 3_600_000)
  const idle = w.disk.rollout(3, T0 - 1_800_000)
  await background($, 'codex exec resume --last "go on"')
  w.disk.event(older, T0 + 3_000, { type: 'task_started' })
  w.disk.event(latest, T0 + 4_000, { type: 'task_started' })
  expect(w.disk.files.get(idle)?.mtimeMs).toBeLessThan(T0)
  await clock.advance(10_000)
  expect(seen.jobs[0]?.rolloutPath).toBe(latest)
})

test('two jobs seconds apart get their own files, created in reverse order', async ($, on) => {
  const { w, clock, seen } = world(on)
  await background($, 'codex exec -m gpt-5.6-sol -o a.md "first"')
  await clock.advance(3_000)
  await background($, 'codex exec -m gpt-5.6-luna -o b.md "second"')
  await clock.settle()
  const second = w.disk.rollout(2, T0 + 4_000, { model: 'gpt-5.6-luna' })
  const first = w.disk.rollout(1, T0 + 6_000, { model: 'gpt-5.6-sol' })
  await clock.advance(10_000)
  expect(seen.jobs[0]?.rolloutPath).toBe(first)
  expect(seen.jobs[1]?.rolloutPath).toBe(second)
})

test("another client's or another directory's rollout is not claimed", async ($, on) => {
  const { w, clock, seen } = world(on)
  await background($, ASTRA)
  w.disk.rollout(1, T0 + 1_000, { originator: 'codex_desktop' })
  w.disk.rollout(2, T0 + 2_000, { cwd: '/other' })
  await clock.advance(10_000)
  expect(seen.jobs[0]?.rolloutPath).toBeUndefined()
  const own = w.disk.rollout(3, T0 + 12_000)
  await clock.advance(10_000)
  expect(seen.jobs[0]?.rolloutPath).toBe(own)
})

test('a job stays pending while its call waits for permission, then starts the clock', async ($, on) => {
  const { clock, statuses, seen } = world(on, { slowMs: 70_000, isAlive: false, toolResult: { backgroundTaskId: 'b1' } })
  const call = $.tool.call({ tool: 'Bash', command: ASTRA, run_in_background: true })
  await clock.advance(60_000)
  expect(seen.jobs[0]?.status).toBe('pending')
  expect(statuses.filter(text => text !== undefined)).toEqual([])
  await clock.advance(10_000)
  await call
  await clock.settle()
  expect(seen.jobs[0]?.status).toBe('running')
  expect(seen.jobs[0]?.startedAt).toBe(T0 + 70_000)
})

test('a refused call drops its job', async ($, on) => {
  const { clock, seen } = world(on, { isRefused: true })
  await background($, ASTRA)
  await clock.settle()
  expect(seen.jobs.length).toBe(0)
})

test('a foreground job runs while its call does, and is done when the run ends', async ($, on) => {
  const { w, clock, seen } = world(on, { slowMs: 60_000 })
  const call = $.tool.call({ tool: 'Bash', command: 'codex exec -m gpt-6-astra "say hi"' })
  const path = w.disk.rollout(1, T0 + 1_000)
  await clock.advance(10_000)
  expect(seen.jobs[0]?.status).toBe('running')
  w.disk.event(path, T0 + 40_000, { type: 'task_complete' })
  await clock.advance(50_000)
  await call
  await clock.settle()
  expect(seen.jobs[0]?.isBackground).toBe(false)
  expect(seen.jobs[0]?.status).toBe('done')
  expect(seen.jobs[0]?.endedAt).toBe(T0 + 40_000)
})

test('a report from an earlier run does not mark a quiet run done', async ($, on) => {
  const { w, clock, seen } = world(on)
  w.disk.files.set('/work/out/report.md', { lines: [], mtimeMs: T0 - 3_600_000 })
  await background($, ASTRA)
  w.disk.rollout(1, T0 + 1_000)
  await clock.advance(120_000)
  expect(seen.jobs[0]?.status).toBe('running')
  w.isAlive = false
  await clock.advance(10_000)
  expect(seen.jobs[0]?.status).toBe('failed')
  expect(seen.jobs[0]?.reason).toBe('codex exited without a report')
})

test('a fresh report, a quiet file and no codex process count as done', async ($, on) => {
  const { w, clock, seen } = world(on)
  await background($, ASTRA)
  w.disk.rollout(1, T0 + 1_000)
  w.disk.files.set('/work/out/report.md', { lines: [], mtimeMs: T0 + 5_000 })
  await clock.advance(60_000)
  expect(seen.jobs[0]?.status).toBe('running')
  w.isAlive = false
  await clock.advance(10_000)
  expect(seen.jobs[0]?.status).toBe('done')
})

test('an error event mid-run is no verdict; turn_aborted is', async ($, on) => {
  const { w, clock, seen } = world(on)
  await background($, ASTRA)
  const path = w.disk.rollout(1, T0 + 1_000)
  w.disk.event(path, T0 + 5_000, { type: 'error', message: 'stream disconnected, retrying' })
  await clock.advance(10_000)
  expect(seen.jobs[0]?.status).toBe('running')
  w.disk.event(path, T0 + 15_000, { type: 'turn_aborted', reason: 'interrupted' })
  await clock.advance(10_000)
  expect(seen.jobs[0]?.status).toBe('failed')
  expect(seen.jobs[0]?.reason).toBe('aborted: interrupted')
})

test('no rollout file and no codex process counts as failed', async ($, on) => {
  const { clock, seen } = world(on, { isAlive: false })
  await background($, ASTRA)
  await clock.advance(40_000)
  expect(seen.jobs[0]?.status).toBe('failed')
  expect(seen.jobs[0]?.reason).toBe('no rollout file and no codex process')
})

test('/codex renders the pane with one row per job', async ($, on) => {
  const { clock, opened, seen } = world(on)
  await $.session.start(START)
  await background($, ASTRA)
  await background($, 'codex exec -m gpt-5.6-sol -o b.md - < b.txt')
  await clock.settle()
  await $.command.run(CODEX)
  expect(opened).toEqual(['codex-jobs'])

  for (const surface of ['terminal', 'desktop'] as const) {
    const ui = await $.ui.mount({ ...PANE, surface })
    for (const job of seen.jobs) expect(await ui.find({ key: `job-${job.id}` })).toBeDefined()
    expect((await ui.findAll({ type: 'Box' })).length).toBe(seen.jobs.length + 1)
    expect(await ui.find({ type: 'Text', text: /gpt-5\.6-sol/ })).toBeDefined()
    await ui.unmount()
  }
})

test('no job leaves the status line empty', async ($, on) => {
  const { clock, statuses } = world(on)
  await $.session.start(START)
  await clock.advance(60_000)
  expect((await $.command.run(CODEX)).text).toBe('No Codex runs in this session yet.')
  expect(statuses.filter(text => text !== undefined)).toEqual([])
  const ui = await $.ui.mount({ ...PANE, surface: 'terminal' })
  expect(await ui.find({ type: 'Text', text: 'No Codex runs' })).toBeDefined()
})
