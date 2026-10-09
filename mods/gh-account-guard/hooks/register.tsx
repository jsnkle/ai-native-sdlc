// gh-account-guard: asks before a `gh` or `git push` shell call runs on a
// GitHub account other than the one the repo's owner needs.
//
// tool.call (Bash, Monitor): read every `gh` and `git push` in the command,
// find the repo owner each one targets and the account it will use (a token,
// the clone's own credential helper, an earlier `gh auth switch` in the same
// command, or the active gh keyring account), and compare with the rules from
// userConfig. On a mismatch, ask in the engine's own question dialog
// (`$.ui.ask`). The rule throughout: when the mod cannot tell, it asks.
// It guards against accidents, not against a command written to evade it.

import type { EngineInterface, Register } from 'claude-code'

const RUN = 'Run anyway'
const CANCEL = 'Cancel'
const FAILED = 'gh-account-guard: its check failed, so the call was refused. Ask the user how to go on.'
const HELPER_KEY = '^credential\\.(https://github\\.com/?\\.)?helper$'
const ENDPOINT = /^\/?(?:repos|orgs|users)\/([^/\s?]+)/
const OTHER_URL = /^([a-z][a-z0-9+.-]*:\/\/|[^\s/:]+:|\.{0,2}\/|~)/i
const TOKEN_NAMES = ['GH_TOKEN', 'GITHUB_TOKEN']
const GH_UNSAFE_ENV = /^(GH_HOST|GH_CONFIG_DIR|GH_ENTERPRISE_TOKEN|GITHUB_ENTERPRISE_TOKEN|GIT_CONFIG.*)$/
const set = (words: string) => new Set(words.split(' '))
// gh commands that act on the working folder's repo when no -R is given; ones that never touch an account's data.
const REPO_SCOPED = set('pr issue repo run workflow release secret variable label cache browse ruleset attestation')
const GH_FREE = set('auth config completion help version search status')
// gh flags that take no value, so the next word is not read as theirs; gh api flags that do take one.
const GH_BOOL = set(
  '--web -w --fill --draft -d --squash -s --merge -m --rebase -r --admin --auto --delete-branch --yes -y --force ' +
    '--private --public --internal --clone --push --watch --exit-status --user -u --delete-last --remote',
)
const API_VALUE = set('-X --method -H --header -f -F --field --raw-field --input -q --jq -t --template --cache -p --preview --hostname')
// Words that can come before the real command, options of theirs that take a value, and commands that run another.
const PREFIXES = set('command exec env nohup time if then elif else while until do ! timeout sudo nice caffeinate')
const PREFIX_VALUE = set('-u -g -n -s -k -C -D -p -r -t -T -U -S')
const WRAPPERS = set('bash sh zsh dash ksh fish eval xargs find parallel watch su ssh script')
const GIT_VALUE = set('-C -c --git-dir --work-tree --namespace --super-prefix --config-env')
const PUSH_VALUE = set('-o --push-option --receive-pack --exec')
const XARGS_VALUE = set('-I -n -P -L -d -E -s -a')

/** One gh or git push in the command. `as`: set by an earlier `gh auth switch` (null: to an unknown account). */
type Target = {
  kind: 'gh' | 'push'; owner?: string; mention?: string; url?: string; remote?: string; unclear?: string
  dir: string | null; gitDir?: string; opts: string[]; token: boolean; as?: string | null; remotesChanged: boolean
}
type GhTarget = Pick<Target, 'owner' | 'mention' | 'remote' | 'unclear'>
type Dest = { owner: string; ssh: boolean }
type Problem =
  | { kind: 'unclear'; why: string }
  | { kind: 'token'; owner: string }
  | { kind: 'account'; owner: string; needs: string | null; uses: string | null; canSwitch: boolean }
type Config = { rules: Map<string, string>; tokenOwners: Set<string> }

export const register: Register = (on, options) => {
  const config: Config = {
    rules: parseRules(String(options.rules ?? '')),
    tokenOwners: new Set(splitList(String(options.tokenOwners ?? ''))),
  }

  on('tool.call', { tool: 'Bash' }, async ($, e, next) => {
    const deny = await judge($, e.command, config)
    return deny === null ? next(e) : { deny }
  }).catch(($, e, next) => (next.called ? next(e) : { deny: FAILED }))

  on('tool.call', { tool: 'Monitor' }, async ($, e, next) => {
    const deny = await judge($, e.command ?? '', config)
    return deny === null ? next(e) : { deny }
  }).catch(($, e, next) => (next.called ? next(e) : { deny: FAILED }))
}

// ---- Deciding --------------------------------------------------------------

/** null to run the call, or the reason it was refused. */
async function judge($: EngineInterface, command: string, config: Config): Promise<string | null> {
  if ((!command.includes('gh') && !command.includes('git')) || parse(command, new Map()).length === 0) return null
  const session = new Map<string, string>([
    ['GH_TOKEN', (await $.env.get('GH_TOKEN')) ?? ''],
    ['GITHUB_TOKEN', (await $.env.get('GITHUB_TOKEN')) ?? ''],
    ['GH_REPO', (await $.env.get('GH_REPO')) ?? ''],
  ])
  const targets = parse(command, session)
  const cwd = await $.session.cwd()
  const home = (await $.env.get('HOME')) ?? '~'
  const expand = (path: string) => path.replace(/^~(?=\/|$)/, home)
  let active: string | null | undefined
  const problems: Problem[] = []
  const accounts = new Set<string>()

  for (const t of targets) {
    if (t.unclear !== undefined) {
      problems.push({ kind: 'unclear', why: t.unclear })
      continue
    }
    const where = ['-C', cwd, ...(t.dir === null ? [] : ['-C', expand(t.dir)]), ...(t.gitDir === undefined ? [] : ['--git-dir', expand(t.gitDir)])]
    const dests =
      t.owner !== undefined ? [{ owner: t.owner, ssh: false }]
      : t.url !== undefined ? destsOf([t.url], t.url)
      : t.remotesChanged ? 'an earlier part of the command changes the git remotes or their config'
      : await lookup($, where, t)
    if (typeof dests === 'string') {
      problems.push({ kind: 'unclear', why: dests })
      continue
    }
    const other = dests.find(d => t.mention !== undefined && d.owner !== t.mention)
    if (other !== undefined) {
      problems.push({ kind: 'unclear', why: `it names the owner ${t.mention} but runs in a repo of ${other.owner}` })
      continue
    }
    let helper: 'own' | 'none' | 'bad' | undefined
    for (const d of dests) {
      if (t.kind === 'push' && d.ssh) continue // an SSH push uses an SSH key, not the gh account
      if (t.token) {
        if (!config.tokenOwners.has(d.owner)) problems.push({ kind: 'token', owner: d.owner })
        continue
      }
      if (t.kind === 'push') {
        helper ??= await ownHelper($, where, t.opts)
        if (helper === 'own') continue // the clone resets the helpers and brings its own
        if (helper === 'bad') {
          problems.push({ kind: 'unclear', why: 'could not read the credential helpers git would use' })
          break
        }
      }
      if (t.as === null) {
        problems.push({ kind: 'unclear', why: 'an earlier part of the command may change the gh account, to one it cannot name' })
        continue
      }
      if (t.as === undefined && active === undefined) active = await activeAccount($)
      const uses = t.as ?? active ?? null
      const needs = config.rules.get(d.owner) ?? null
      if (needs !== null) accounts.add(needs)
      if (uses === null || needs === null || needs.toLowerCase() !== uses.toLowerCase()) {
        problems.push({ kind: 'account', owner: d.owner, needs, uses, canSwitch: needs !== null && uses !== null && t.as === undefined })
      }
    }
  }
  return problems.length === 0 ? null : decide($, command, problems, accounts)
}

/** Where a push or a repo-scoped gh call goes, read from the repo it runs in; a string says why it could not tell. */
async function lookup($: EngineInterface, where: string[], t: Target): Promise<Dest[] | string> {
  let remote = t.remote
  if (remote === undefined) {
    // A bare `git push`: where git itself sends the branch (pushRemote, pushDefault, upstream).
    const run = await $.process.run(['git', ...where, 'rev-parse', '--abbrev-ref', '@{push}'], { timeoutMs: 10000 })
    remote = run.exitCode === 0 && !run.isStdoutTruncated ? /^([^/\s]+)\/\S+$/.exec(run.stdout.trim())?.[1] : undefined
    if (remote === undefined) return 'could not tell where git push sends the current branch'
  }
  const argv = ['git', ...where, 'remote', 'get-url', ...(t.kind === 'push' ? ['--push', '--all'] : []), remote]
  const run = await $.process.run(argv, { timeoutMs: 10000 })
  if (run.exitCode !== 0 || run.isStdoutTruncated) return `could not read the remote ${remote} of the repo it runs in`
  return destsOf(run.stdout.split('\n'), remote)
}

/** The GitHub owners among URLs; a string when one cannot be read or none is given. */
function destsOf(urls: string[], name: string): Dest[] | string {
  const lines = urls.map(u => u.trim()).filter(u => u !== '')
  if (lines.length === 0) return `the remote ${name} gave no URL`
  const dests: Dest[] = []
  for (const url of lines) {
    const owner = urlOwner(url)
    if (owner !== undefined) {
      dests.push({ owner, ssh: /^(ssh:|git\+ssh:|[^/:]+:(?!\/\/))/.test(url) })
    } else if (/github/i.test(url) || !OTHER_URL.test(url)) {
      return `could not read the remote URL ${url.slice(0, 200)}`
    }
  }
  return dests
}

/** Asks the user about the first problem; null to run the call, or the reason it was refused. */
async function decide($: EngineInterface, command: string, problems: Problem[], accounts: Set<string>): Promise<string | null> {
  const [first] = problems
  if (first === undefined) return null
  const others = problems.slice(1)
  const target = first.kind === 'account' && first.canSwitch ? first.needs : null
  const same = target !== null && others.every(p => p.kind === 'account' && p.canSwitch && p.needs === target)
  const account = same && accounts.size <= 1 ? target : null
  const switchLabel = `Switch to ${account} and run`
  const labels = account === null ? [RUN, CANCEL] : [switchLabel, RUN, CANCEL]
  const { what, todo } = explain(first)
  const more =
    (others.length === 0 ? '' : ` It also has ${others.length} more ${others.length === 1 ? 'problem' : 'problems'} like this.`) +
    (accounts.size > 1 ? ` Its parts need different accounts (${[...accounts].join(', ')}), so no one switch makes it all right.` : '')
  const shown = command.length > 120 ? `${command.slice(0, 117)}...` : command

  let answer = ''
  try {
    answer = await $.ui.ask(`${what}${more} Run \`${shown}\`?`, { options: labels, header: 'GitHub' })
  } catch {
    answer = '' // dismissed, or nobody to ask (a -p run)
  }
  if (answer === RUN) return null
  if (account !== null && answer === switchLabel) {
    const run = await $.process.run(['gh', 'auth', 'switch', '--hostname', 'github.com', '--user', account], { timeoutMs: 15000 })
    if (run.exitCode === 0) {
      $.ui.toast(`gh-account-guard: switched to ${account}`)
      return null
    }
    return `gh-account-guard did not run this call: switching to ${account} failed (${run.stderr.trim().slice(0, 300)}). ${what} ${todo}`
  }
  const outcome =
    answer === CANCEL ? 'the user chose Cancel' : answer === '' ? 'the question was dismissed or could not be asked' : `the user answered "${answer.slice(0, 200)}"`
  return `gh-account-guard did not run this call: ${outcome}. ${what}${more} ${todo}`
}

/** What is wrong, and what the model should do about it. */
function explain(p: Problem): { what: string; todo: string } {
  if (p.kind === 'unclear') {
    return { what: `gh-account-guard could not tell which repo or account this call uses: ${p.why}.`, todo: 'Ask the user how to go on.' }
  }
  if (p.kind === 'token') {
    return {
      what: `This call runs with a GH_TOKEN/GITHUB_TOKEN token, and the repo owner ${p.owner} is not in the tokenOwners setting.`,
      todo: 'Run it without the token, or ask the user.',
    }
  }
  if (p.uses === null) {
    return { what: `No gh account is active, and this call targets the repo owner ${p.owner}.`, todo: 'Ask the user to log in with `gh auth login`.' }
  }
  if (p.needs === null) {
    return { what: `No rule names an account for the repo owner ${p.owner}; this call would run as ${p.uses}.`, todo: 'Ask the user which account to use.' }
  }
  return {
    what: `The repo owner ${p.owner} needs the GitHub account ${p.needs}, but this call would run as ${p.uses}.`,
    todo: `If the user agrees, run \`gh auth switch --user ${p.needs}\` first, then retry.`,
  }
}

/** 'own' when the clone's config (or the command's -c) resets the helpers and then adds its own; 'bad' when unreadable. */
async function ownHelper($: EngineInterface, where: string[], opts: string[]): Promise<'own' | 'none' | 'bad'> {
  const extra = opts.flatMap(o => ['-c', o])
  const run = await $.process.run(['git', ...where, ...extra, 'config', '--show-scope', '--get-regexp', HELPER_KEY], { timeoutMs: 10000 })
  if (run.exitCode === 1 && run.stdout.trim() === '') return 'none' // no helper configured at all
  if (run.exitCode !== 0 || run.isStdoutTruncated) return 'bad'
  let resetBy = ''
  let after = 0
  for (const line of run.stdout.split('\n').filter(l => l !== '')) {
    const m = /^(\w+)\t\S+ ?(.*)$/.exec(line)
    if (m === null) return 'bad'
    if ((m[2] ?? '').trim() === '') {
      resetBy = m[1] ?? ''
      after = 0
    } else {
      after += 1
    }
  }
  return ['local', 'worktree', 'command'].includes(resetBy) && after > 0 ? 'own' : 'none'
}

/** The active keyring account for github.com: the `user` key `gh auth switch` rewrites; no network. */
async function activeAccount($: EngineInterface): Promise<string | null> {
  const run = await $.process.run(['gh', 'config', 'get', '-h', 'github.com', 'user'], { timeoutMs: 10000 })
  const account = run.exitCode === 0 ? run.stdout.trim() : ''
  return /^[A-Za-z0-9-]+$/.test(account) ? account : null
}

// ---- Reading the command ---------------------------------------------------

/** Every gh and git push in the command, in order. `session`: GH_TOKEN, GITHUB_TOKEN and GH_REPO as Claude Code has them. */
function parse(command: string, session: Map<string, string>): Target[] {
  const { segments, spans } = lex(command)
  const targets: Target[] = []
  const exported = new Map(session)
  const base = { dir: null, opts: [], token: false, remotesChanged: false }
  if (spans.some(runsGhIn)) {
    targets.push({ kind: 'gh', ...base, unclear: 'it runs gh or git push inside $(...) or backticks' })
  }
  let dir: string | null = null
  let as: string | null | undefined
  let asIsConditional = false
  let remotesChanged = false
  for (const { sep, words } of segments) {
    // A switch holds for later parts only when they surely run after it: joined by ; or &&, never || | or &.
    if (as !== undefined && (['||', '|', '&'].includes(sep) || (asIsConditional && (sep === ';' || sep === '\n')))) as = null
    const env = new Map(exported)
    const i = skipPrefixes(words, env)
    const isCall = i >= 0 // `command -v gh` only describes it
    const cmd = baseName(words[i] ?? '')
    const args = words.slice(i + 1)
    const unsafe = [...env.keys()].find(name => GH_UNSAFE_ENV.test(name) && env.get(name) !== '')
    const scope = {
      dir, as, remotesChanged, opts: [] as string[],
      token: TOKEN_NAMES.some(name => (env.get(name) ?? '') !== ''),
      ...(unsafe === undefined ? {} : { unclear: `it sets ${unsafe}` }),
    }
    if (!isCall) continue
    if (cmd === 'cd') {
      dir = joinDir(dir, args[0])
    } else if (cmd === 'export' || cmd === 'unset') {
      for (const a of args) {
        const m = /^([A-Za-z_]\w*)(?:=([^]*))?$/.exec(a)
        if (m !== null && (cmd === 'unset' || m[2] !== undefined)) exported.set(m[1] ?? '', cmd === 'unset' ? '' : m[2] ?? '')
      }
    } else if (WRAPPERS.has(cmd)) {
      if (wraps(cmd, args)) targets.push({ kind: 'gh', ...scope, unclear: `it runs gh or git push through ${cmd}` })
    } else if (cmd === 'gh' && args[0] === 'auth' && ['switch', 'login', 'logout'].includes(args[1] ?? '')) {
      const user = args[1] === 'switch' ? flagValue(args, '--user', '-u') ?? null : null
      as = sep === '' || sep === ';' || sep === '\n' || sep === '&&' ? user : null
      asIsConditional = sep === '&&'
    } else if (cmd === 'gh') {
      const target = ghTarget(args, env.get('GH_REPO') ?? '')
      if (target !== null) targets.push({ kind: 'gh', ...scope, ...target })
    } else if (cmd === 'git') {
      const git = gitCall(args, dir, env.get('GIT_DIR'))
      const sub = git.args[0]
      if ((sub === 'remote' && ['add', 'set-url', 'rename', 'remove', 'rm'].includes(git.args[1] ?? '')) ||
          (sub === 'config' && git.args.some(a => /^(remote|url|branch)\./i.test(a)))) {
        remotesChanged = true
      } else if (sub === 'push') {
        const target = pushTarget(git.args.slice(1))
        if (target !== null) targets.push({ ...scope, unclear: git.unclear ?? scope.unclear, ...target, dir: git.dir, gitDir: git.gitDir, opts: git.opts })
      }
    }
  }
  return targets
}

/** What a gh call targets, or null when it touches no account's data. */
function ghTarget(args: string[], ghRepo: string): GhTarget | null {
  const sub = args[0]
  if (sub === undefined || sub.startsWith('-') || GH_FREE.has(sub) || args.includes('--help') || args.includes('-h')) return null
  const decisive = new Set<string>()
  const mentioned = new Set<string>()
  const positional: string[] = []
  let method = ''
  let fields = false
  let org: string | undefined
  let unclear: string | undefined
  const addRepo = (value: string, what: string) => {
    const owner = repoOwner(value)
    if (owner !== undefined) decisive.add(owner)
    else unclear ??= `${what} ${value} is not a github.com repo it can read`
  }
  for (let i = 1; i < args.length; i += 1) {
    const a = args[i] ?? ''
    if (!a.startsWith('-')) {
      positional.push(a)
      const owner = urlOwner(a)
      if (owner !== undefined) decisive.add(owner)
      continue
    }
    const long = a.startsWith('--')
    const eq = a.indexOf('=')
    const flag = long ? (eq < 0 ? a : a.slice(0, eq)) : a.slice(0, 2)
    let value = long ? (eq < 0 ? undefined : a.slice(eq + 1)) : a.length > 2 ? a.slice(2) : undefined
    if (value === undefined && (sub === 'api' ? API_VALUE.has(flag) : !GH_BOOL.has(flag))) value = args[(i += 1)]
    if (value === undefined) continue
    if (flag === '-R' || flag === '--repo') addRepo(value, '-R')
    else if (flag === '--hostname' && value.toLowerCase() !== 'github.com') unclear ??= `it targets the host ${value}`
    else if (flag === '-X' || flag === '--method') method = value.toUpperCase()
    else if (['-f', '-F', '--field', '--raw-field'].includes(flag)) fields = true
    else if ((flag === '-H' || flag === '--header') && /^\s*authorization\s*:/i.test(value)) unclear ??= 'it sends its own Authorization header'
    else if (flag === '-o' || flag === '--org') org = value
    const owner = flag === '--input' ? undefined : urlOwner(value)
    if (owner !== undefined) mentioned.add(owner)
  }
  const [action, first] = positional
  if (sub === 'repo' && first?.includes('/') === true) addRepo(first, 'the repo')
  if ((sub === 'secret' || sub === 'variable' || (sub === 'repo' && action === 'fork')) && org !== undefined) decisive.add(org.toLowerCase())
  let fromRemote = false
  if (sub === 'api') {
    for (const word of positional) {
      const owner = ENDPOINT.exec(word)?.[1]
      if (owner === '{owner}') fromRemote = true
      else if (owner !== undefined) decisive.add(owner.toLowerCase())
    }
  }
  if (unclear !== undefined) return { unclear }
  const all = new Set([...decisive, ...mentioned])
  if (decisive.size > 1 || all.size > 1) return { unclear: `it names more than one owner (${[...all].join(', ')})` }
  const [owner] = decisive
  if (owner !== undefined) return { owner }
  const mention = [...mentioned][0]
  const fromEnv = repoOwner(ghRepo)
  const remote: GhTarget =
    ghRepo === '' ? { remote: 'origin', mention }
    : fromEnv !== undefined && (mention === undefined || mention === fromEnv) ? { owner: fromEnv }
    : { unclear: `GH_REPO ${ghRepo} is not a github.com repo it can read, or names another owner than the command` }
  if (sub === 'api') {
    if (fromRemote) return remote
    if (action === 'graphql') return { unclear: 'a gh api graphql call names no repo' }
    if (method === 'GET') return null // an explicit GET: fields are query parameters
    return method !== '' || fields ? { unclear: 'a gh api call that writes names no repo' } : null
  }
  if (sub === 'repo' && (action === 'list' || action === 'clone')) return null
  if (sub === 'repo' && (action === 'create' || action === 'fork')) return { unclear: `gh repo ${action} names no owner, so it would use whichever account is active` }
  if (sub === 'gist') return action === 'list' || action === 'view' ? null : { unclear: 'gists belong to whichever account is active' }
  if ((sub === 'secret' || sub === 'variable') && (args.includes('-u') || args.includes('--user'))) {
    return { unclear: `a user-level ${sub} belongs to whichever account is active` }
  }
  return REPO_SCOPED.has(sub) ? remote : { unclear: `gh ${sub} acts for whichever account is active` }
}

/** git's own options before the subcommand: where it runs, and config that could change the push. */
function gitCall(args: string[], start: string | null, gitDirEnv: string | undefined) {
  let dir = start
  let gitDir = gitDirEnv
  let unclear: string | undefined
  const opts: string[] = []
  let i = 0
  for (; i < args.length && (args[i] ?? '').startsWith('-'); i += 1) {
    const a = args[i] ?? ''
    const eq = a.startsWith('--') ? a.indexOf('=') : -1
    const name = eq < 0 ? a : a.slice(0, eq)
    const value = eq >= 0 ? a.slice(eq + 1) : GIT_VALUE.has(name) ? args[(i += 1)] ?? '' : ''
    if (name === '-C') dir = joinDir(dir, value)
    if (name === '--git-dir') gitDir = value
    const key = (value.split('=')[0] ?? '').toLowerCase()
    if (name === '-c' && key.startsWith('credential.')) opts.push(value) // modelled by ownHelper
    else if ((name === '-c' || name === '--config-env') && /^(remote|url|branch|credential)\.|pushurl/.test(key)) {
      unclear = `it overrides the git config ${key}`
    }
  }
  return { args: args.slice(i), dir, gitDir, opts, unclear }
}

function pushTarget(args: string[]): Pick<Target, 'kind' | 'url' | 'remote' | 'unclear'> | null {
  let positional: string | undefined
  let repoFlag: string | undefined
  for (let j = 0; j < args.length; j += 1) {
    const a = args[j] ?? ''
    if (a === '--repo') repoFlag = args[(j += 1)]
    else if (a.startsWith('--repo=')) repoFlag = a.slice(7)
    else if (PUSH_VALUE.has(a)) j += 1
    else if (!a.startsWith('-') && positional === undefined) positional = a
  }
  const remote = positional ?? repoFlag
  if (remote === undefined || /^[\w.-]+$/.test(remote)) return { kind: 'push', remote } // a remote name, or git's own choice
  if (urlOwner(remote) !== undefined) return { kind: 'push', url: remote }
  return /github/i.test(remote) || !OTHER_URL.test(remote) ? { kind: 'push', unclear: `could not read the push destination ${remote}` } : null
}

function flagValue(args: string[], long: string, short: string): string | undefined {
  for (let i = 0; i < args.length; i += 1) {
    const a = args[i] ?? ''
    if (a === long || a === short) return args[i + 1]
    if (a.startsWith(`${long}=`)) return a.slice(long.length + 1)
  }
  return undefined
}

/** True when a command that runs another (a shell, eval, xargs, find -exec, ssh) would run gh or git push. */
function wraps(cmd: string, args: string[]): boolean {
  if (cmd === 'xargs') {
    let i = 0
    while ((args[i] ?? '').startsWith('-')) i += XARGS_VALUE.has(args[i] ?? '') ? 2 : 1
    return runsGh(args.slice(i))
  }
  if (cmd === 'find') return args.some((a, i) => /^-(exec|execdir|ok|okdir)$/.test(a) && runsGh(args.slice(i + 1)))
  // A shell string: read it as a command line of its own.
  const script = args.findIndex(a => /^-[a-z]*c[a-z]*$/i.test(a))
  if (['bash', 'sh', 'zsh', 'dash', 'ksh', 'fish', 'su'].includes(cmd) && script >= 0) return runsGhIn(args[script + 1] ?? '')
  let i = 0
  while ((args[i] ?? '').startsWith('-')) i += PREFIX_VALUE.has(args[i] ?? '') ? 2 : 1
  return runsGhIn(args.slice(cmd === 'ssh' ? i + 1 : i).join(' '))
}

/**
 * The index of a segment's command word, past VAR=value words and prefixes like sudo, env or timeout
 * and their options; -1 for `command -v`. Assignments and `env -u`/`-i` are written to `env`.
 */
function skipPrefixes(words: string[], env = new Map<string, string>()): number {
  let i = 0
  while (i < words.length) {
    const word = words[i] ?? ''
    const assign = /^([A-Za-z_]\w*)=([^]*)$/.exec(word)
    if (assign !== null) {
      env.set(assign[1] ?? '', assign[2] ?? '')
      i += 1
      continue
    }
    const prefix = baseName(word)
    if (!PREFIXES.has(prefix)) break
    i += 1
    if (prefix === 'command' && /^-[vV]$/.test(words[i] ?? '')) return -1
    while ((words[i] ?? '').startsWith('-')) {
      const flag = words[i] ?? ''
      if (prefix === 'env' && flag === '-i') TOKEN_NAMES.forEach(name => env.set(name, ''))
      if (prefix === 'env' && flag === '-u') env.set(words[i + 1] ?? '', '')
      i += prefix !== 'command' && PREFIX_VALUE.has(flag) ? 2 : 1 // command's own flags take no value
    }
    if (prefix === 'timeout') i += 1 // the duration
  }
  return i
}

/** True when a command line runs gh or git push anywhere it can be read, $(...) included. */
function runsGhIn(text: string): boolean {
  const { segments, spans } = lex(text)
  return segments.some(s => runsGh(s.words.slice(Math.max(0, skipPrefixes(s.words))))) || spans.some(runsGhIn)
}

function runsGh(words: string[]): boolean {
  const cmd = baseName(words[0] ?? '')
  return cmd === 'gh' || (cmd === 'git' && words.includes('push')) || (WRAPPERS.has(cmd) && wraps(cmd, words.slice(1)))
}

function baseName(word: string): string {
  return word.replace(/^\\/, '').split('/').pop() ?? ''
}

/** `OWNER/REPO`, `github.com/OWNER/REPO` or a URL to the owner, lower case. */
function repoOwner(value: string): string | undefined {
  const parts = value.split('/')
  if (parts.length === 2 && /^[A-Za-z0-9-]+$/.test(parts[0] ?? '')) return parts[0]?.toLowerCase()
  if (parts.length === 3 && parts[0]?.toLowerCase() === 'github.com') return parts[1]?.toLowerCase()
  return urlOwner(value)
}

/** The owner in a github.com https URL, or an ssh/scp URL whose host starts with `github` (alias hosts too). */
function urlOwner(value: string): string | undefined {
  const m =
    /^https?:\/\/(?:[^@/]+@)?github\.com\/([A-Za-z0-9-]+)\/[\w.-]+/i.exec(value) ??
    /^(?:git\+)?ssh:\/\/(?:[^@/]+@)?github[\w.-]*(?::\d+)?\/([A-Za-z0-9-]+)\/[\w.-]+/i.exec(value) ??
    /^(?:[^@/:]+@)?github[\w.-]*:([A-Za-z0-9-]+)\/[\w.-]+/i.exec(value)
  return m?.[1]?.toLowerCase()
}

function joinDir(dir: string | null, arg: string | undefined): string | null {
  if (arg === undefined || arg === '~' || arg.startsWith('/') || arg.startsWith('~/')) return arg ?? '~'
  return dir === null ? arg : `${dir}/${arg}`
}

/**
 * Splits a command into segments of words in one pass: quotes and escapes join a
 * word, `;` `&&` `||` `|` `&` and new lines end a segment (`sep` is the one before
 * it), `#` starts a comment, redirections are dropped, and the text of every
 * `$(...)` and backtick span is kept apart in `spans`.
 */
function lex(text: string): { segments: { sep: string; words: string[] }[]; spans: string[] } {
  const segments: { sep: string; words: string[] }[] = []
  const spans: string[] = []
  let words: string[] = []
  let word = ''
  let inWord = false
  let skipWord = false
  let sep = ''
  const endWord = () => {
    if (inWord && !skipWord) words.push(word)
    if (inWord) skipWord = false
    word = ''
    inWord = false
  }
  const endSegment = (next: string) => {
    endWord()
    const kept = words.filter(w => w !== '{' && w !== '}')
    if (kept.length > 0) segments.push({ sep, words: kept })
    if (kept.length > 0 || next !== '\n') sep = next
    words = []
  }
  /** The index just past the span that opens at `start` (`$(` or a backtick). */
  const span = (start: number): number => {
    const tick = text[start] === '`'
    let depth = 0
    let i = tick ? start + 1 : start + 2
    for (; i < text.length; i += 1) {
      const c = text[i]
      if (c === '\\') i += 1
      else if (tick && c === '`') break
      else if (!tick && c === '(') depth += 1
      else if (!tick && c === ')' && depth-- === 0) break
    }
    spans.push(text.slice(tick ? start + 1 : start + 2, i))
    return i + 1
  }
  for (let i = 0; i < text.length; ) {
    const c = text[i] ?? ''
    const next = text[i + 1] ?? ''
    if (c === '\\') {
      if (next !== '\n') {
        word += next
        inWord = true
      }
      i += 2
    } else if (c === "'") {
      const end = text.indexOf("'", i + 1)
      word += text.slice(i + 1, end < 0 ? text.length : end)
      inWord = true
      i = end < 0 ? text.length : end + 1
    } else if (c === '"') {
      inWord = true
      for (i += 1; i < text.length && text[i] !== '"'; ) {
        if (text[i] === '\\' && /["\\$`]/.test(text[i + 1] ?? '')) {
          word += text[i + 1]
          i += 2
        } else if ((text[i] === '$' && text[i + 1] === '(') || text[i] === '`') {
          const end = span(i)
          word += text.slice(i, end)
          i = end
        } else {
          word += text[i]
          i += 1
        }
      }
      i += 1
    } else if ((c === '$' && next === '(') || c === '`') {
      const end = span(i)
      word += text.slice(i, end)
      inWord = true
      i = end
    } else if (c === '#' && !inWord) {
      const end = text.indexOf('\n', i)
      i = end < 0 ? text.length : end
    } else if (c === '>' || c === '<' || (c === '&' && next === '>')) {
      if (/^\d+$/.test(word)) inWord = false // a file descriptor: 2>
      endWord()
      while (/[<>&|]/.test(text[i] ?? '')) i += 1
      skipWord = true // the file or descriptor it redirects to
    } else if (c === ';' || c === '\n' || c === '&' || c === '|') {
      const two = c + next
      const op = two === '&&' || two === '||' ? two : two === '|&' ? '|' : c
      endSegment(op)
      i += two === '&&' || two === '||' || two === '|&' ? 2 : 1
    } else if (c === ' ' || c === '\t' || c === '(' || c === ')') {
      endWord()
      i += 1
    } else {
      word += c
      inWord = true
      i += 1
    }
  }
  endSegment('')
  return { segments, spans }
}

// ---- Options ---------------------------------------------------------------

/** `account=owner,owner; account=owner` to a map of owner (lower case) to account. */
function parseRules(text: string): Map<string, string> {
  const rules = new Map<string, string>()
  for (const part of text.split(/[;\n]/)) {
    const [account, owners] = part.split('=')
    const name = (account ?? '').trim()
    if (name === '' || owners === undefined) continue
    for (const owner of splitList(owners)) {
      if (!rules.has(owner)) rules.set(owner, name)
    }
  }
  return rules
}

function splitList(text: string): string[] {
  return text
    .split(/[,\s]+/)
    .map(s => s.trim().toLowerCase())
    .filter(s => s !== '')
}
