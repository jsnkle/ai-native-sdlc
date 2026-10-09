// codex-job-board: watches Bash calls that run `codex exec`, finds each run's
// rollout file under the Codex home, and shows the runs on the status line
// and in a /codex pane. It only observes: every Bash call goes on unchanged.

import { atom, read, update } from 'claude-code'
import type { EngineInterface, Register, Timer } from 'claude-code'

import type { CodexJob } from '../types'

const PANE = 'codex-jobs'
const TITLE = 'Codex jobs'
const POLL_MS = 10_000
const QUIET_MS = 30_000
/** How long a job settled by a quiet file is looked at again, in case its file grows. */
const RECHECK_MS = 5 * 60_000
/** Slack between the clock that stamps a job and the one that stamps a rollout. */
const SKEW_MS = 5_000
const DAY_MS = 86_400_000
const TURN_EVENTS = '"type":"(task_started|task_complete|turn_aborted|error|token_count)"'
const TURN_CONTEXT = '"type":"turn_context"'

/**
 * `codex exec` where a command starts: at the start, after `;`, `&`, `|`,
 * `(`, `{`, a newline, `$(`, `then`, `do` or `else`, past `nohup`, `time`,
 * `sudo`, `env [-u X]`, `timeout N` or `VAR=value`, the binary by name or
 * path. Run on the command with quoted spans and heredoc bodies masked.
 */
const CODEX_EXEC = /(?:^|[;&|(\n`{]|\$\(|\b(?:then|do|else)\s)\s*(?:(?:nohup|time|command|sudo|timeout\s+\S+|env(?:\s+-u\s+\S+)*)\s+|\w+=\S*\s+)*(?:[^\s;&|()`]*\/)?codex\s+exec(?=\s|$)/
/** A `cd <dir> &&` (or `;`) before the codex call, on the masked command. */
const CD = /(?:^|[;&|(\n{]|\b(?:then|do)\s)\s*cd\s+([^\s;&|()]+)\s*(?:&&|;|\n)/g

const jobs = atom({ plugin: 'codex-job-board', key: 'jobs' } as const, [])
const hasAutoOpened = atom({ plugin: 'codex-job-board', key: 'hasAutoOpened' } as const, false)

// Module variables start over on a hot reload, which also drops their timer;
// the jobs live in $.state, and session.start (fired again by a reload)
// starts the poller again while a job is open.
let ticker: Timer | undefined
let isChecking = false
/** Rollout files another Codex client wrote: never a job's, so never read twice. */
const foreign = new Set<string>()

// ---------------------------------------------------------------- parsing

/** The command at the same length, quoted spans and heredoc bodies blanked to `_`. */
function mask(command: string): string {
  let out = ''
  let quote = ''
  let docs: { tag: string; isTabbed: boolean }[] = []
  let i = 0
  while (i < command.length) {
    const ch = command[i] ?? ''
    if (quote !== '') {
      if (ch === quote) quote = ''
      if (quote === '"' && ch === '\\' && i + 1 < command.length) {
        out += '__'
        i += 2
        continue
      }
      out += ch === quote || quote === '' ? ch : ch === '\n' ? '\n' : '_'
      i++
      continue
    }
    if (ch === '\\') {
      out += i + 1 < command.length ? '__' : '_'
      i += 2
      continue
    }
    if (ch === "'" || ch === '"') {
      quote = ch
      out += ch
      i++
      continue
    }
    if (ch === '<' && command.startsWith('<<', i) && !command.startsWith('<<<', i)) {
      const doc = /^<<(-?)[ \t]*(['"]?)([\w.-]+)\2/.exec(command.slice(i, i + 256))
      if (doc !== null) {
        docs.push({ tag: doc[3] ?? '', isTabbed: doc[1] === '-' })
        out += '_'.repeat(doc[0].length)
        i += doc[0].length
        continue
      }
    }
    if (ch === '\n' && docs.length > 0) {
      out += '\n'
      i++
      for (const doc of docs) {
        while (i < command.length) {
          const end = command.indexOf('\n', i)
          const stop = end < 0 ? command.length : end
          const text = command.slice(i, stop)
          out += '_'.repeat(text.length) + (end < 0 ? '' : '\n')
          i = stop + 1
          if ((doc.isTabbed ? text.replace(/^\t+/, '') : text) === doc.tag) break
        }
      }
      docs = []
      continue
    }
    out += ch
    i++
  }
  return out
}

/** Shell-ish words from `at` up to the first operator. */
function wordsFrom(command: string, at: number): string[] {
  const words: string[] = []
  let word = ''
  let hasWord = false
  let quote = ''
  for (const ch of command.slice(at)) {
    if (quote !== '') {
      if (ch === quote) quote = ''
      else word += ch
      continue
    }
    if (ch === "'" || ch === '"') {
      quote = ch
      hasWord = true
      continue
    }
    if (/[;|&<>\n]/.test(ch)) break
    if (/\s/.test(ch)) {
      if (hasWord) words.push(word)
      word = ''
      hasWord = false
      continue
    }
    word += ch
    hasWord = true
  }
  if (hasWord) words.push(word)
  return words
}

const VALUE_FLAGS = new Set([
  '-m', '--model', '-o', '--output-last-message', '-c', '--config', '-C', '--cd',
  '-s', '--sandbox', '-p', '--profile', '-i', '--image', '--color', '--output-schema',
  '--add-dir', '--enable', '--disable',
])

type ParsedCommand = {
  model?: string
  reportPath?: string
  cd?: string
  cdBefore?: string
  resumeId?: string
  isResumeLast?: boolean
}

function parseCodexCommand(command: string): ParsedCommand | undefined {
  const masked = mask(command)
  const match = CODEX_EXEC.exec(masked)
  if (match === null) return undefined
  const at = match.index + match[0].lastIndexOf('codex')
  const words = wordsFrom(command, at)
  const parsed: ParsedCommand = {}
  for (const cd of masked.slice(0, at).matchAll(CD)) {
    const start = (cd.index ?? 0) + cd[0].lastIndexOf(cd[1] ?? '')
    parsed.cdBefore = wordsFrom(command, start)[0]
  }
  const positional: string[] = []
  for (let i = 2; i < words.length; i++) {
    const word = words[i] ?? ''
    const eq = word.indexOf('=')
    const flag = word.startsWith('--') && eq > 0 ? word.slice(0, eq) : word
    const inline = flag !== word ? word.slice(eq + 1) : undefined
    if (VALUE_FLAGS.has(flag)) {
      const value = inline ?? words[++i]
      if (flag === '-m' || flag === '--model') parsed.model = value
      if (flag === '-o' || flag === '--output-last-message') parsed.reportPath = value
      if (flag === '-C' || flag === '--cd') parsed.cd = value
      continue
    }
    if (word === '--last') parsed.isResumeLast = true
    if (!word.startsWith('-')) positional.push(word)
  }
  if (positional[0] === 'resume' && !parsed.isResumeLast && positional[1] !== undefined) {
    parsed.resumeId = positional[1]
  }
  return parsed
}

function resolvePath(base: string, path: string, home: string): string {
  if (path.startsWith('/')) return path
  if (path === '~') return home
  if (path.startsWith('~/')) return `${home}${path.slice(1)}`
  return `${base.replace(/\/$/, '')}/${path.replace(/^\.\//, '')}`
}

// ------------------------------------------------------------- formatting

function formatDuration(ms: number): string {
  const s = Math.max(0, Math.floor(ms / 1000))
  if (s < 60) return `${s}s`
  const m = Math.floor(s / 60)
  if (m < 60) return `${m}m`
  return `${Math.floor(m / 60)}h${String(m % 60).padStart(2, '0')}m`
}

function formatTokens(n: number | undefined): string {
  if (n === undefined) return '-'
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(2)}M`
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`
  return String(n)
}

function contextPercent(job: CodexJob): string {
  const { contextTokens, contextWindow } = job
  if (contextTokens === undefined || contextWindow === undefined || contextWindow <= 0) return '-'
  return `${Math.round((contextTokens / contextWindow) * 100)}%`
}

/** The last 8 characters: Codex ids are UUIDv7, whose leading ones repeat for runs a minute apart. */
const shortId = (id: string | undefined) => (id === undefined ? 'pending' : id.slice(-8))

const isOpen = (job: CodexJob) => job.status === 'pending' || job.status === 'running'

function statusLine(list: readonly CodexJob[], now: number): string | undefined {
  const running = list.filter(job => job.status === 'running')
  if (running.length === 0) return undefined
  const oldest = Math.min(...running.map(job => job.startedAt))
  return `codex ${running.length} running ${formatDuration(now - oldest)}`
}

// --------------------------------------------------------- codex's files

async function codexHome($: EngineInterface): Promise<string> {
  const own = await $.env.get('CODEX_HOME')
  if (own !== undefined && own !== '') return own
  return `${(await $.env.get('HOME')) ?? ''}/.codex`
}

async function run($: EngineInterface, argv: string[]): Promise<string> {
  try {
    const { exitCode, stdout } = await $.process.run(argv)
    return exitCode === 0 ? stdout : ''
  } catch {
    return ''
  }
}

const lines = (text: string) => text.split('\n').filter(line => line.trim() !== '')

function parseLine(line: string | undefined): Record<string, unknown> | undefined {
  try {
    const value: unknown = JSON.parse(line ?? '')
    return typeof value === 'object' && value !== null ? (value as Record<string, unknown>) : undefined
  } catch {
    return undefined
  }
}

const payloadOf = (row: Record<string, unknown> | undefined) =>
  (typeof row?.payload === 'object' && row.payload !== null ? row.payload : (row ?? {})) as Record<string, unknown>

/** `YYYY/MM/DD` folders that can hold a file created at `at`, whatever the local time zone. */
function dateFolders(sessions: string, at: number): string[] {
  return [-1, 0, 1].map(days => {
    const d = new Date(at + days * DAY_MS)
    const mm = String(d.getUTCMonth() + 1).padStart(2, '0')
    const dd = String(d.getUTCDate()).padStart(2, '0')
    return `${sessions}/${d.getUTCFullYear()}/${mm}/${dd}`
  })
}

/**
 * When the rollout at `path` was created, if `codex exec` wrote it in the
 * job's directory (and, for a new run with `-m`, on the job's model).
 */
async function fit($: EngineInterface, job: CodexJob, path: string, isNewRun: boolean) {
  const meta = payloadOf(parseLine(await run($, ['head', '-n', '1', path])))
  if (meta.originator !== 'codex_exec') {
    if (meta.originator !== undefined) foreign.add(path)
    return undefined
  }
  if (String(meta.cwd ?? '').replace(/\/$/, '') !== job.codexCwd.replace(/\/$/, '')) return undefined
  const at = Date.parse(String(meta.timestamp ?? ''))
  if (Number.isNaN(at)) return undefined
  if (isNewRun && job.model !== undefined) {
    const turn = payloadOf(parseLine(await run($, ['grep', '-m', '1', TURN_CONTEXT, path])))
    if (turn.model !== job.model) return undefined
  }
  return at
}

/** Finds the rollout file a job writes, skipping files other open jobs claimed. */
async function findRollout($: EngineInterface, job: CodexJob, claimed: Set<string>, now: number) {
  const sessions = `${await codexHome($)}/sessions`
  if (job.resumeId !== undefined) {
    const named = lines(await run($, ['find', sessions, '-name', `rollout-*${job.resumeId}.jsonl`]))[0]
    if (named !== undefined) return named
  }
  if (job.resumeId !== undefined || job.isResumeLast === true) {
    // Resumed: the latest file created before the call and written since.
    const minutes = String(Math.ceil((now - job.startedAt) / 60_000) + 1)
    let best: { path: string; at: number } | undefined
    for (const path of lines(await run($, ['find', sessions, '-name', 'rollout-*.jsonl', '-mmin', `-${minutes}`]))) {
      if (claimed.has(path) || foreign.has(path)) continue
      const stat = await $.fs.stat(path).catch(() => undefined)
      if (stat === undefined || stat.mtimeMs < job.startedAt - SKEW_MS) continue
      const at = await fit($, job, path, false)
      if (at !== undefined && at < job.startedAt && (best === undefined || at > best.at)) best = { path, at }
    }
    return best?.path
  }
  // New: the earliest file created after the call, from the date folders around it.
  let best: { path: string; at: number } | undefined
  for (const folder of dateFolders(sessions, job.startedAt)) {
    const entries = await $.fs.list(folder).catch(() => [])
    for (const entry of entries) {
      const path = `${folder}/${entry.name}`
      if (!/^rollout-.*\.jsonl$/.test(entry.name) || entry.mtimeMs < job.startedAt - SKEW_MS) continue
      if (claimed.has(path) || foreign.has(path)) continue
      const at = await fit($, job, path, true)
      if (at !== undefined && at >= job.startedAt - SKEW_MS && (best === undefined || at < best.at)) best = { path, at }
    }
  }
  return best?.path
}

type RolloutScan = {
  totalTokens?: number
  contextTokens?: number
  contextWindow?: number
  finish?: { status: 'done' | 'failed'; at: number; reason?: string }
  lastError?: string
}

/** The last token counts, and how the job's turn ended: events before `since` belong to earlier runs. */
function scanRollout(text: string, since: number): RolloutScan {
  const scan: RolloutScan = {}
  for (const line of lines(text)) {
    const row = parseLine(line)
    const event = payloadOf(row)
    if (event.type === 'token_count') {
      const info = event.info as {
        total_token_usage?: { total_tokens?: unknown }
        last_token_usage?: { total_tokens?: unknown }
        model_context_window?: unknown
      } | null | undefined
      const total = info?.total_token_usage?.total_tokens
      const last = info?.last_token_usage?.total_tokens
      if (typeof total === 'number') scan.totalTokens = total
      if (typeof last === 'number') scan.contextTokens = last
      if (typeof info?.model_context_window === 'number') scan.contextWindow = info.model_context_window
      continue
    }
    const at = Date.parse(String(row?.timestamp ?? ''))
    if (!Number.isNaN(at) && at < since - SKEW_MS) continue
    if (event.type === 'task_started') delete scan.finish
    if (event.type === 'task_complete') scan.finish = { status: 'done', at }
    if (event.type === 'turn_aborted') scan.finish = { status: 'failed', at, reason: `aborted: ${String(event.reason ?? '')}` }
    // Not a verdict: Codex goes on after some errors. It names the failure if the run dies.
    if (event.type === 'error') scan.lastError = `error: ${String(event.message ?? '').slice(0, 80)}`
  }
  return scan
}

/** Asks once per check whether any `codex exec` runs (not `codex exec-server`, which the ChatGPT app keeps). */
async function isCodexAlive($: EngineInterface, memo: { isAlive?: boolean }) {
  memo.isAlive ??= (await run($, ['pgrep', '-f', 'codex exec([[:space:]]|$)'])).trim() !== ''
  return memo.isAlive
}

type Ended = { isError: boolean }

/**
 * Brings one job up to date. `ended` is set when its foreground Bash call
 * returned; `undefined` back means drop the job (the call was refused).
 */
async function check($: EngineInterface, job: CodexJob, claimed: Set<string>, now: number, memo: { isAlive?: boolean }, ended?: Ended) {
  const updated: CodexJob = { ...job }
  updated.rolloutPath ??= await findRollout($, job, claimed, now)
  let scan: RolloutScan = {}
  if (updated.rolloutPath !== undefined) {
    claimed.add(updated.rolloutPath)
    // A rollout of its own means the call got past its permission prompt.
    if (updated.status === 'pending') updated.status = 'running'
    updated.sessionId = /([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})\.jsonl$/i.exec(updated.rolloutPath)?.[1]
    scan = scanRollout(await run($, ['grep', '-E', TURN_EVENTS, updated.rolloutPath]), job.startedAt)
    if (scan.totalTokens !== undefined) updated.totalTokens = scan.totalTokens
    if (scan.contextTokens !== undefined) updated.contextTokens = scan.contextTokens
    if (scan.contextWindow !== undefined) updated.contextWindow = scan.contextWindow
  }
  const settle = (status: 'done' | 'failed', endedAt: number, endedBy: CodexJob['endedBy'], reason?: string): CodexJob =>
    ({ ...updated, status, endedAt, endedBy, ...(reason === undefined ? {} : { reason }) })
  const { finish } = scan
  if (finish !== undefined && updated.status === 'running') {
    return settle(finish.status, Number.isNaN(finish.at) ? now : finish.at, 'rollout', finish.reason)
  }
  if (ended !== undefined) {
    if (ended.isError && updated.rolloutPath === undefined) return undefined
    return ended.isError ? settle('failed', now, 'bash', scan.lastError ?? 'the Bash call failed') : settle('done', now, 'bash')
  }
  if (updated.status === 'pending') return updated
  const rollout = updated.rolloutPath === undefined ? undefined : await $.fs.stat(updated.rolloutPath).catch(() => undefined)
  const quietSince = rollout?.mtimeMs ?? job.startedAt
  if (now - quietSince < QUIET_MS || (await isCodexAlive($, memo))) return updated
  const report = job.reportFile === undefined ? undefined : await $.fs.stat(job.reportFile).catch(() => undefined)
  if (rollout !== undefined && report !== undefined && report.mtimeMs >= job.startedAt) return settle('done', quietSince, 'quiet')
  const reason = scan.lastError ?? (rollout === undefined ? 'no rollout file and no codex process' : 'codex exited without a report')
  return settle('failed', quietSince, 'quiet', reason)
}

/** A job settled by a quiet file, recent, whose file grew since and no later job took over. */
async function shouldRecheck($: EngineInterface, job: CodexJob, list: readonly CodexJob[], now: number) {
  if (job.endedBy !== 'quiet' || job.rolloutPath === undefined || job.endedAt === undefined) return false
  if (now - job.endedAt > RECHECK_MS) return false
  const isTakenOver = list.some(other => other.startedAt > job.startedAt && (other.rolloutPath === job.rolloutPath || other.resumeId === job.sessionId))
  if (isTakenOver) return false
  const stat = await $.fs.stat(job.rolloutPath).catch(() => undefined)
  return stat !== undefined && stat.mtimeMs > job.endedAt + 1_000
}

// ------------------------------------------------------------------ polling

type Focus = { id: string; ended?: Ended; isBackground?: boolean }

/** Checks the open jobs (or only `focus`) and writes what changed. */
async function refresh($: EngineInterface, focus?: Focus) {
  const isTick = focus === undefined
  if (isTick && isChecking) return
  if (isTick) isChecking = true
  try {
    const now = await $.clock.now()
    const list = await read($, jobs)
    const claimed = new Set(list.flatMap(job => (isOpen(job) && job.rolloutPath !== undefined ? [job.rolloutPath] : [])))
    const memo: { isAlive?: boolean } = {}
    const checked = new Map<string, CodexJob | undefined>()
    const reopened = new Set<string>()
    for (const job of list) {
      if (focus !== undefined && job.id !== focus.id) continue
      if (!isOpen(job)) continue
      let current = job
      if (focus?.isBackground === true) {
        // The call returned: the run starts now, not when it asked for permission.
        current = { ...job, isBackground: true, status: 'running', startedAt: job.status === 'pending' ? now : job.startedAt }
      }
      checked.set(job.id, await check($, current, claimed, now, memo, focus?.ended))
    }
    if (isTick) {
      for (const job of list) {
        if (isOpen(job) || !(await shouldRecheck($, job, list, now))) continue
        const again = await check($, { ...job, status: 'running' }, claimed, now, memo)
        if (again?.status === 'running') {
          const { endedAt: _endedAt, endedBy: _endedBy, reason: _reason, ...rest } = again
          checked.set(job.id, rest)
          reopened.add(job.id)
        }
      }
    }
    const after = await update($, jobs, current =>
      current.flatMap(job => {
        if (!checked.has(job.id)) return [job]
        const next = checked.get(job.id)
        // A verdict written meanwhile (a foreground call's own check) stands.
        if (next === undefined) return []
        return isOpen(job) || reopened.has(job.id) ? [next] : [job]
      }),
    )
    $.ui.status(statusLine(after, now))
    const isWatching = after.some(job => isOpen(job) || (job.endedBy === 'quiet' && job.endedAt !== undefined && now - job.endedAt < RECHECK_MS))
    if (!isWatching && ticker !== undefined) {
      ticker.cancel()
      ticker = undefined
    }
    const hasFinished = [...checked.values()].some(job => job !== undefined && !isOpen(job))
    if (hasFinished && !(await read($, hasAutoOpened))) {
      const opened = await $.ui.open({ id: PANE, title: TITLE })
      if (opened.isPlaced) await update($, hasAutoOpened, () => true)
      else await $.ui.close({ id: PANE })
    }
  } finally {
    if (isTick) isChecking = false
  }
}

function startPolling($: EngineInterface) {
  ticker ??= $.clock.every(POLL_MS, () => void refresh($))
}

/** After the Bash call returned: settle a foreground job, or mark a background one running. */
async function settleCall($: EngineInterface, id: string, ran: { isError?: true; result?: unknown }) {
  const record = ran.result as { backgroundTaskId?: unknown; interrupted?: unknown } | undefined
  const list = await read($, jobs)
  const job = list.find(one => one.id === id)
  if (job === undefined) return
  const isBackground = job.isBackground || (ran.isError !== true && typeof record?.backgroundTaskId === 'string')
  if (isBackground && ran.isError !== true) {
    await refresh($, { id, isBackground: true })
    startPolling($)
    return
  }
  await refresh($, { id, ended: { isError: ran.isError === true || record?.interrupted === true } })
}

/** Records a job for a Bash call that runs `codex exec`. */
async function recordJob($: EngineInterface, id: string, command: string, isBackground: boolean): Promise<boolean> {
  const parsed = parseCodexCommand(command)
  if (parsed === undefined) return false
  const startedAt = await $.clock.now()
  const home = (await $.env.get('HOME')) ?? ''
  const sessionCwd = await $.session.cwd()
  const base = parsed.cdBefore === undefined ? sessionCwd : resolvePath(sessionCwd, parsed.cdBefore, home)
  const asked = parsed.cd === undefined ? base : resolvePath(base, parsed.cd, home)
  // Codex records its directory with links resolved (/tmp is /private/tmp on macOS).
  const codexCwd = (await $.fs.stat(asked, { resolve: true }).catch(() => undefined))?.realPath ?? asked
  const { cd: _cd, cdBefore: _cdBefore, ...rest } = parsed
  const job: CodexJob = {
    id,
    command,
    ...rest,
    ...(parsed.reportPath === undefined ? {} : { reportFile: resolvePath(base, parsed.reportPath, home) }),
    codexCwd,
    isBackground,
    startedAt,
    status: 'pending',
  }
  await update($, jobs, current => [...current, job].slice(-50))
  startPolling($)
  return true
}

export const register: Register = on => {
  on('session.start', async ($, e, next) => {
    await $.command.register({ name: 'codex', description: 'Show the Codex runs started in this session' })
    const list = await read($, jobs)
    if (list.some(isOpen)) {
      startPolling($)
      $.ui.status(statusLine(list, await $.clock.now()))
    }
    return next(e)
  })

  on('tool.call', { tool: 'Bash' }, async ($, e, next) => {
    if (!e.command.includes('codex')) return next(e)
    const isJob = await recordJob($, e.tool_use_id, e.command, e.run_in_background === true)
    const ran = await next(e)
    // The model gets the result now; the job is settled just after.
    if (isJob) $.clock.after(0, () => void settleCall($, e.tool_use_id, ran))
    return ran
  }).catch(($, e, next) => next(e))

  on('command.run', { command: 'codex' }, async $ => {
    await $.ui.open({ id: PANE, title: TITLE })
    const list = await read($, jobs)
    if (list.length === 0) return { text: 'No Codex runs in this session yet.' }
    const rows = list.map(job => {
      const id = job.sessionId ?? 'session id not found yet'
      const tokens = job.totalTokens === undefined ? '' : `, ${job.totalTokens} tokens, context ${contextPercent(job)}`
      const report = job.reportPath === undefined ? '' : `, report ${job.reportPath}`
      return `${id}: ${job.status}${tokens}${report}`
    })
    return { text: `Codex runs:\n${rows.join('\n')}` }
  })

  on('ui.render', { component: 'Pane', requestId: PANE }, async ($, e) => {
    const { Box, Text } = $.ui.resolve(e)
    const list = await read($, jobs)
    const now = await $.clock.now()
    if (list.length === 0) {
      return (
        <Box flexDirection="column">
          <Text dimColor>No Codex runs in this session yet.</Text>
        </Box>
      )
    }
    const head = `${'session'.padEnd(9)}${'model'.padEnd(14)}${'time'.padEnd(7)}${'status'.padEnd(8)}${'tokens'.padEnd(8)}${'ctx'.padEnd(5)}report`
    return (
      <Box flexDirection="column">
        <Text dimColor wrap="truncate-end">{head}</Text>
        {list.map(job => {
          const time = formatDuration((job.endedAt ?? now) - job.startedAt)
          const color = job.status === 'failed' ? 'error' : job.status === 'done' ? 'success' : 'warning'
          return (
            <Box key={`job-${job.id}`} flexDirection="row">
              <Text wrap="truncate-end">
                {shortId(job.sessionId).padEnd(9)}
                {(job.model ?? 'default').slice(0, 13).padEnd(14)}
                {time.padEnd(7)}
                <Text color={color}>{job.status.padEnd(8)}</Text>
                {formatTokens(job.totalTokens).padEnd(8)}
                {contextPercent(job).padEnd(5)}
              </Text>
              <Text dimColor wrap="truncate-start">{job.reportPath ?? '-'}</Text>
            </Box>
          )
        })}
      </Box>
    )
  })
}
