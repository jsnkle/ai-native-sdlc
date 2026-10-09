import type { On } from 'claude-code'
import { describe, expect, mock, test } from 'claude-code/testing'

// Made-up accounts and owners: acct-a works for owner-a, acct-b for owner-b and org-b.
// The mod asks through `$.ui.ask` (the engine's AskUserQuestion dialog) and draws no
// tree of its own, so there is nothing to mount and no per-surface loop: the dialog is
// answered here by a test hook on the AskUserQuestion tool call.
const RULES = 'acct-a=owner-a; acct-b=owner-b,org-b'
const OPTIONS = { options: { rules: RULES } }

type World = {
  remotes?: Record<string, string> // remote name -> URL (several push URLs: one per line)
  push?: string // the remote `@{push}` names; '' when git has none; origin when left out
  active: string // the active keyring login; '' for none
  helpers?: { exitCode: number; stdout: string } // `git config --show-scope --get-regexp` answer
  env?: Record<string, string>
  answer?: string // the label chosen, or free text; undefined dismisses
  failProcess?: boolean
}

/** The world beneath the plugin: git, gh, the question dialog and the shell tools. */
function setup(on: On, world: World) {
  const runs: string[] = []
  const ran: string[] = []
  const asked: { question: string; labels: string[] }[] = []
  mock.env(on, world.env ?? { HOME: '/home/me' })
  const result = (exitCode: number, stdout = '') => ({
    value: { exitCode, stdout, stderr: '', isStdoutTruncated: false, isStderrTruncated: false },
  })
  on('session.cwd', () => ({ value: '/work/repo' }))
  on('process.run', ($, e) => {
    if (world.failProcess === true) {
      throw new Error('cannot start')
    }
    const argv = e.argv.join(' ')
    runs.push(argv)
    if (argv.endsWith('rev-parse --abbrev-ref @{push}')) {
      return world.push === '' ? result(128) : result(0, `${world.push ?? 'origin'}/main\n`)
    }
    if (argv.includes(' remote get-url')) {
      const url = world.remotes?.[e.argv[e.argv.length - 1] ?? '']
      return url === undefined ? result(2) : result(0, `${url}\n`)
    }
    if (argv.includes(' config --show-scope')) {
      return world.helpers === undefined ? result(1) : result(world.helpers.exitCode, world.helpers.stdout)
    }
    if (argv === 'gh config get -h github.com user') {
      return world.active === '' ? result(1) : result(0, `${world.active}\n`)
    }
    if (argv.startsWith('gh auth switch')) {
      world.active = e.argv[e.argv.length - 1] ?? world.active
      return result(0)
    }
    return result(1)
  })
  on('ui.toast', () => ({ value: undefined }))
  on('tool.call', { tool: 'AskUserQuestion' }, ($, e) => {
    const [q] = e.questions
    asked.push({ question: q?.question ?? '', labels: (q?.options ?? []).map(o => o.label) })
    if (world.answer === undefined) {
      return { deny: 'The user dismissed the question.' }
    }
    return { result: { questions: e.questions, answers: { [q?.question ?? '']: world.answer } } }
  })
  on('tool.call', { tool: 'Bash' }, ($, e) => {
    ran.push(e.command)
    return { result: { stdout: 'ok', stderr: '', interrupted: false } }
  })
  on('tool.call', { tool: 'Monitor' }, ($, e) => {
    ran.push(e.command ?? '')
    return { result: { taskId: 'm1' } as never }
  })
  return { runs, ran, asked }
}

const bash = (command: string) => ({ tool: 'Bash' as const, command, tool_use_id: `t-${command.length}` })
const URL_A = 'https://github.com/owner-a/app.git'
const URL_B = 'https://github.com/owner-b/app'
const A = { origin: URL_A }
const B = { origin: URL_B }
const NEEDS_B = 'owner-b needs the GitHub account acct-b'
const UNCLEAR = 'could not tell which repo or account'

describe('gh-account-guard', () => {
  test('ordinary Bash calls are not inspected', OPTIONS, async ($, on) => {
    const w = setup(on, { remotes: A, active: 'acct-b' })
    expect((await $.tool.call(bash('ls -la && git status'))).deny).toBeUndefined()
    expect(w.runs).toEqual([])
  })

  test('a match passes through with no question', OPTIONS, async ($, on) => {
    const w = setup(on, { remotes: { origin: 'git@github.com:owner-a/app.git' }, active: 'acct-a' })
    expect((await $.tool.call(bash('gh pr list'))).deny).toBeUndefined()
    expect(w.ran).toEqual(['gh pr list'])
    expect(w.asked).toEqual([])
  })

  test('a long comment is read in linear time', OPTIONS, async ($, on) => {
    setup(on, { remotes: A, active: 'acct-a' })
    const started = Date.now()
    expect((await $.tool.call(bash(`# ${'git '.repeat(64000)}`))).deny).toBeUndefined()
    expect(Date.now() - started).toBeLessThan(500)
  })

  describe('the question', () => {
    test('Cancel denies, naming both accounts and the switch command', OPTIONS, async ($, on) => {
      const w = setup(on, { remotes: B, active: 'acct-a', answer: 'Cancel' })
      const ran = await $.tool.call(bash('git push origin main'))
      expect(w.asked[0]?.labels).toEqual(['Switch to acct-b and run', 'Run anyway', 'Cancel'])
      expect(ran.deny).toContain('the user chose Cancel')
      expect(ran.deny).toContain('would run as acct-a')
      expect(ran.deny).toContain('gh auth switch --user acct-b')
      expect(w.ran).toEqual([])
    })

    test('Switch runs gh auth switch, then the call', OPTIONS, async ($, on) => {
      const w = setup(on, { remotes: B, active: 'acct-a', answer: 'Switch to acct-b and run' })
      expect((await $.tool.call(bash('gh pr create --fill'))).deny).toBeUndefined()
      expect(w.runs).toContain('gh auth switch --hostname github.com --user acct-b')
      expect(w.ran).toEqual(['gh pr create --fill'])
    })

    test('Run anyway runs the call unchanged', OPTIONS, async ($, on) => {
      const w = setup(on, { remotes: B, active: 'acct-a', answer: 'Run anyway' })
      expect((await $.tool.call(bash('gh pr list'))).deny).toBeUndefined()
      expect(w.runs.some(r => r.startsWith('gh auth switch'))).toBe(false)
      expect(w.ran).toEqual(['gh pr list'])
    })

    test('a dismissed question (or a -p run) denies with the switch command', OPTIONS, async ($, on) => {
      const w = setup(on, { remotes: B, active: 'acct-a' })
      const ran = await $.tool.call(bash('gh pr list'))
      expect(ran.deny).toContain('dismissed or could not be asked')
      expect(ran.deny).toContain('gh auth switch --user acct-b')
      expect(w.ran).toEqual([])
    })

    test('a free-text answer denies and is passed on', OPTIONS, async ($, on) => {
      setup(on, { remotes: B, active: 'acct-a', answer: 'use the other repo' })
      expect((await $.tool.call(bash('gh pr list'))).deny).toContain('use the other repo')
    })

    test('parts that need different accounts get no Switch option', OPTIONS, async ($, on) => {
      const w = setup(on, { active: 'acct-a', answer: 'Cancel' })
      const ran = await $.tool.call(bash(`git push ${URL_A} HEAD; git push ${URL_B} HEAD`))
      expect(w.asked[0]?.labels).toEqual(['Run anyway', 'Cancel'])
      expect(ran.deny).toContain('need different accounts (acct-a, acct-b)')
    })
  })

  test('no rule for the owner: no Switch option', OPTIONS, async ($, on) => {
    const w = setup(on, { remotes: { origin: 'https://github.com/stranger/app' }, active: 'acct-a', answer: 'Cancel' })
    const ran = await $.tool.call(bash('gh issue list'))
    expect(w.asked[0]?.labels).toEqual(['Run anyway', 'Cancel'])
    expect(ran.deny).toContain('No rule names an account for the repo owner stranger')
  })

  test('no active gh account: no Switch option', OPTIONS, async ($, on) => {
    const w = setup(on, { remotes: A, active: '', answer: 'Cancel' })
    const ran = await $.tool.call(bash('git push'))
    expect(w.asked[0]?.labels).toEqual(['Run anyway', 'Cancel'])
    expect(ran.deny).toContain('No gh account is active')
    expect(ran.deny).toContain('gh auth login')
  })

  describe('gh commands', () => {
    test('account-free commands pass without a lookup', OPTIONS, async ($, on) => {
      const w = setup(on, { remotes: B, active: 'acct-a' })
      for (const command of [
        'gh --version', 'gh auth status', 'gh search repos guard', 'gh pr create --help', 'gh api user',
        'gh api -X GET search/issues -f q=x', 'gh repo list', 'command -v gh',
      ]) {
        expect((await $.tool.call(bash(command))).deny, command).toBeUndefined()
      }
      expect(w.runs).toEqual([])
    })

    test('a write with no owner holds', OPTIONS, async ($, on) => {
      setup(on, { remotes: A, active: 'acct-a' })
      for (const command of ['gh repo create scratch --private', 'gh gist create notes.md', 'gh codespace list', 'gh ssh-key add k.pub', 'gh secret set X --user']) {
        expect((await $.tool.call(bash(command))).deny, command).toContain('whichever account is active')
      }
    })

    test('a write with a named owner is judged', OPTIONS, async ($, on) => {
      setup(on, { active: 'acct-a' })
      expect((await $.tool.call(bash('gh repo create owner-a/scratch --private'))).deny).toBeUndefined()
      expect((await $.tool.call(bash('gh secret set X --org owner-b'))).deny).toContain(NEEDS_B)
    })

    test('-R owner/repo beats the remote', OPTIONS, async ($, on) => {
      const w = setup(on, { remotes: A, active: 'acct-a' })
      expect((await $.tool.call(bash('gh issue list -R owner-b/other'))).deny).toContain(NEEDS_B)
      expect(w.runs.some(r => r.includes('remote get-url'))).toBe(false)
    })

    test('GH_REPO on the command is the target', OPTIONS, async ($, on) => {
      setup(on, { remotes: A, active: 'acct-a' })
      expect((await $.tool.call(bash('GH_REPO=owner-b/app gh pr list'))).deny).toContain(NEEDS_B)
    })

    test('GH_HOST or GH_CONFIG_DIR on the command asks', OPTIONS, async ($, on) => {
      setup(on, { remotes: A, active: 'acct-a' })
      expect((await $.tool.call(bash('GH_HOST=ghe.example gh pr list'))).deny).toContain('it sets GH_HOST')
      expect((await $.tool.call(bash('export GH_CONFIG_DIR=/tmp/x; gh pr list'))).deny).toContain('it sets GH_CONFIG_DIR')
    })

    test('a positional GitHub URL names the owner, after a flag that takes no value too', OPTIONS, async ($, on) => {
      setup(on, { remotes: A, active: 'acct-a' })
      expect((await $.tool.call(bash('gh pr view https://github.com/org-b/tool/pull/7'))).deny).toContain('org-b needs the GitHub account acct-b')
      expect((await $.tool.call(bash('gh pr comment --delete-last https://github.com/owner-b/app/pull/1'))).deny).toContain(NEEDS_B)
    })

    test('a URL swallowed by an unknown flag is still compared with the remote', OPTIONS, async ($, on) => {
      setup(on, { remotes: A, active: 'acct-a' })
      const ran = await $.tool.call(bash('gh pr comment --some-new-flag https://github.com/owner-b/app/pull/1'))
      expect(ran.deny).toContain('names the owner owner-b but runs in a repo of owner-a')
    })

    test('text in a flag value is not a URL', OPTIONS, async ($, on) => {
      setup(on, { remotes: B, active: 'acct-a' })
      expect((await $.tool.call(bash("gh pr create --body 'see https://github.com/owner-a/app/pull/1'"))).deny).toContain(NEEDS_B)
    })

    test('two owners in one call are held', OPTIONS, async ($, on) => {
      setup(on, { active: 'acct-a' })
      expect((await $.tool.call(bash('gh pr view https://github.com/owner-a/x/pull/1 -R owner-b/y'))).deny).toContain('more than one owner')
    })

    test('every target is judged, not only the first', OPTIONS, async ($, on) => {
      setup(on, { remotes: A, active: 'acct-a' })
      expect((await $.tool.call(bash('gh pr list && gh pr merge 3 -R owner-b/app'))).deny).toContain(NEEDS_B)
    })

    test('a failed, empty or unreadable remote lookup holds', OPTIONS, async ($, on) => {
      const world: World = { active: 'acct-a' }
      setup(on, world)
      expect((await $.tool.call(bash('gh pr list'))).deny).toContain('could not read the remote origin')
      world.remotes = { origin: '' }
      expect((await $.tool.call(bash('gh pr list'))).deny).toContain('gave no URL')
      world.remotes = { origin: 'not a url' }
      expect((await $.tool.call(bash('gh pr list'))).deny).toContain('could not read the remote URL')
    })

    test('an alias SSH host counts as GitHub', OPTIONS, async ($, on) => {
      setup(on, { remotes: { origin: 'git@github-work:owner-b/app.git' }, active: 'acct-a' })
      expect((await $.tool.call(bash('gh pr list'))).deny).toContain(NEEDS_B)
    })

    test('a Monitor call is judged too', OPTIONS, async ($, on) => {
      setup(on, { remotes: B, active: 'acct-a' })
      const ran = await $.tool.call({ tool: 'Monitor', command: 'gh run watch 42', description: 'watch', timeout_ms: 60000 })
      expect(ran.deny).toContain(NEEDS_B)
    })
  })

  describe('gh api', () => {
    test('the owner comes from the endpoint, whatever flags come first', OPTIONS, async ($, on) => {
      setup(on, { active: 'acct-a' })
      for (const command of [
        'gh api -X POST repos/owner-b/app/issues',
        'gh api --method PATCH -H "Accept: x" /repos/owner-b/app',
        'gh api -f title=x repos/owner-b/app/issues',
        'gh api --paginate orgs/owner-b/repos',
      ]) {
        expect((await $.tool.call(bash(command))).deny, command).toContain(NEEDS_B)
      }
    })

    test('an --input file name is not an owner', OPTIONS, async ($, on) => {
      setup(on, { active: 'acct-a' })
      expect((await $.tool.call(bash('gh api --input repos/owner-b/body.json -X POST repos/owner-a/app/issues'))).deny).toBeUndefined()
    })

    test('graphql, a write with no owner and an own Authorization header ask', OPTIONS, async ($, on) => {
      setup(on, { active: 'acct-a' })
      expect((await $.tool.call(bash("gh api graphql -f query='{ viewer { login } }'"))).deny).toContain('graphql call names no repo')
      expect((await $.tool.call(bash('gh api -X POST user/repos -f name=x'))).deny).toContain('writes names no repo')
      expect((await $.tool.call(bash("gh api -H 'Authorization: token x' repos/owner-a/app"))).deny).toContain('Authorization header')
    })
  })

  describe('git push', () => {
    test('a bare push goes where git sends it (pushRemote, pushDefault, upstream)', OPTIONS, async ($, on) => {
      const w = setup(on, { remotes: { origin: URL_A, fork: URL_B }, push: 'fork', active: 'acct-a' })
      expect((await $.tool.call(bash('git push'))).deny).toContain(NEEDS_B)
      expect(w.runs).toContain('git -C /work/repo remote get-url --push --all fork')
    })

    test('a push git has no destination for asks', OPTIONS, async ($, on) => {
      setup(on, { remotes: A, push: '', active: 'acct-a' })
      expect((await $.tool.call(bash('git push'))).deny).toContain('could not tell where git push sends')
    })

    test('every push URL of the remote is judged', OPTIONS, async ($, on) => {
      setup(on, { remotes: { origin: `${URL_A}\n${URL_B}` }, active: 'acct-a' })
      expect((await $.tool.call(bash('git push origin main'))).deny).toContain(NEEDS_B)
    })

    test('cd and --git-dir move where the remote is read', OPTIONS, async ($, on) => {
      const w = setup(on, { remotes: A, active: 'acct-a' })
      await $.tool.call(bash('cd ../other && git push origin'))
      await $.tool.call(bash('git --git-dir /srv/x.git --work-tree /srv/x push origin'))
      expect(w.runs).toContain('git -C /work/repo -C ../other remote get-url --push --all origin')
      expect(w.runs).toContain('git -C /work/repo --git-dir /srv/x.git remote get-url --push --all origin')
    })

    test('changing remotes or their config earlier in the command asks', OPTIONS, async ($, on) => {
      setup(on, { remotes: A, active: 'acct-a' })
      expect((await $.tool.call(bash(`git remote add x ${URL_A} && git push x main`))).deny).toContain('changes the git remotes')
      expect((await $.tool.call(bash(`git remote set-url origin ${URL_B}; git push`))).deny).toContain('changes the git remotes')
    })

    test('git config overrides that reach the push ask', OPTIONS, async ($, on) => {
      setup(on, { remotes: A, active: 'acct-a' })
      expect((await $.tool.call(bash(`git -c remote.origin.pushurl=${URL_B} push origin`))).deny).toContain('overrides the git config remote.origin.pushurl')
      expect((await $.tool.call(bash('GIT_CONFIG_COUNT=1 git push origin'))).deny).toContain('it sets GIT_CONFIG_COUNT')
    })

    test('a non-GitHub remote passes', OPTIONS, async ($, on) => {
      const w = setup(on, { remotes: { origin: 'https://gitlab.example/owner-b/app.git' }, active: 'acct-a' })
      expect((await $.tool.call(bash('git push'))).deny).toBeUndefined()
      expect(w.ran).toEqual(['git push'])
    })

    test('an SSH push is not judged', OPTIONS, async ($, on) => {
      const w = setup(on, { remotes: { origin: 'git@github.com:owner-b/app.git' }, active: 'acct-a' })
      expect((await $.tool.call(bash('git push'))).deny).toBeUndefined()
      expect(w.runs.some(r => r.startsWith('gh config get'))).toBe(false)
    })

    test('a clone that resets the helpers and brings its own stands the guard down, for pushes only', OPTIONS, async ($, on) => {
      const stdout = 'global\tcredential.helper !gh auth git-credential\nlocal\tcredential.helper \nlocal\tcredential.helper !agent-helper\n'
      setup(on, { remotes: B, active: 'acct-a', helpers: { exitCode: 0, stdout } })
      expect((await $.tool.call(bash('git push'))).deny).toBeUndefined()
      expect((await $.tool.call(bash('gh pr list'))).deny).toContain(NEEDS_B) // gh never uses git helpers
    })

    test('a clone helper added after the global one, with no reset, does not stand the guard down', OPTIONS, async ($, on) => {
      const stdout = 'global\tcredential.helper !gh auth git-credential\nlocal\tcredential.helper !agent-helper\n'
      setup(on, { remotes: B, active: 'acct-a', helpers: { exitCode: 0, stdout } })
      expect((await $.tool.call(bash('git push'))).deny).toContain(NEEDS_B)
    })

    test('helper output it cannot read asks', OPTIONS, async ($, on) => {
      setup(on, { remotes: B, active: 'acct-a', helpers: { exitCode: 0, stdout: 'something unexpected\n' } })
      expect((await $.tool.call(bash('git push'))).deny).toContain('could not read the credential helpers')
    })
  })

  describe('reading the command', () => {
    test('mentions in echo, grep, comments and a PR body pass', OPTIONS, async ($, on) => {
      setup(on, { remotes: A, active: 'acct-a' })
      for (const command of [
        'echo "run git push later"',
        'grep -r "gh pr" docs',
        'ls # then gh pr merge -R owner-b/x',
        `gh pr create --title t --body "$(cat <<'EOF'\nFixes the git push step; see gh pr 3\nEOF\n)"`,
      ]) {
        expect((await $.tool.call(bash(command))).deny, command).toBeUndefined()
      }
    })

    test('gh or git push inside a nested shell, $(...) or xargs asks, even beside a target it can read', OPTIONS, async ($, on) => {
      setup(on, { remotes: A, active: 'acct-a' })
      for (const [command, why] of [
        ['bash -c "git push"', 'through bash'],
        ["gh pr list -R owner-a/app; bash -c 'gh pr merge 1 -R owner-b/app'", 'through bash'],
        ['echo 3 | xargs -n1 gh pr merge', 'through xargs'],
        ['find . -name x -exec gh pr merge {} \\;', 'through find'],
        ['git push origin $(gh api user -q .login)', 'inside $(...)'],
      ] as const) {
        expect((await $.tool.call(bash(command))).deny, command).toContain(why)
      }
    })

    test('full paths, quotes, backslashes and prefixes on the command word are seen', OPTIONS, async ($, on) => {
      setup(on, { remotes: B, active: 'acct-a' })
      for (const command of [
        '/usr/bin/git push', '"gh" pr list', '\\gh pr list', 'timeout 30 sudo -u me gh pr list',
        '/usr/bin/env gh pr list', 'command -p git push', 'nice -n 5 caffeinate -i gh pr list', 'if true; then gh pr list; fi',
      ]) {
        expect((await $.tool.call(bash(command))).deny, command).toContain(NEEDS_B)
      }
    })
  })

  describe('accounts', () => {
    test('gh auth switch earlier in the command is the account later parts use', OPTIONS, async ($, on) => {
      const w = setup(on, { remotes: B, active: 'acct-b' })
      expect((await $.tool.call(bash('gh auth switch --user acct-a && git push'))).deny).toContain('would run as acct-a')
      expect(w.asked[0]?.labels).toEqual(['Run anyway', 'Cancel'])
      expect((await $.tool.call(bash('gh auth switch --user acct-b && git push'))).deny).toBeUndefined()
      expect((await $.tool.call(bash('gh auth login && git push'))).deny).toContain('cannot name')
    })

    test('a switch that may not run, or is only text, does not count', OPTIONS, async ($, on) => {
      setup(on, { remotes: B, active: 'acct-a' })
      for (const command of ['false && gh auth switch --user acct-b; git push', 'gh auth switch --user acct-b || git push']) {
        expect((await $.tool.call(bash(command))).deny, command).toContain('cannot name')
      }
      for (const command of ["echo 'x; gh auth switch -u acct-b; y'; git push", 'git push # see gh auth login', 'echo "gh auth switch" && git push']) {
        expect((await $.tool.call(bash(command))).deny, command).toContain(NEEDS_B)
      }
    })

    test('every judged command reads the active account afresh', OPTIONS, async ($, on) => {
      const world: World = { remotes: A, active: 'acct-a' }
      const w = setup(on, world)
      expect((await $.tool.call(bash('gh pr list'))).deny).toBeUndefined()
      world.active = 'acct-b' // another session switched the global account
      expect((await $.tool.call(bash('gh pr list'))).deny).toContain('would run as acct-b')
      expect(w.runs.filter(r => r.startsWith('gh config get'))).toHaveLength(2)
    })

    test('GH_TOKEN: allowed owners pass, others are held', { options: { rules: RULES, tokenOwners: 'owner-b' } }, async ($, on) => {
      const world: World = { remotes: B, active: 'acct-a', env: { HOME: '/home/me', GH_TOKEN: 'fake' } }
      const w = setup(on, world)
      expect((await $.tool.call(bash('gh pr list'))).deny).toBeUndefined()
      expect(w.runs.some(r => r.startsWith('gh config get'))).toBe(false)
      world.remotes = A
      expect((await $.tool.call(bash('gh pr list'))).deny).toContain('GH_TOKEN')
    })

    test('an empty or unset token is no token', OPTIONS, async ($, on) => {
      setup(on, { remotes: A, active: 'acct-a', env: { HOME: '/home/me', GH_TOKEN: 'fake' } })
      expect((await $.tool.call(bash('gh pr list'))).deny).toContain('GH_TOKEN')
      expect((await $.tool.call(bash('GH_TOKEN= gh pr list'))).deny).toBeUndefined()
      expect((await $.tool.call(bash('env -u GH_TOKEN gh pr list'))).deny).toBeUndefined()
    })

    test('a token set on the command counts, a mention does not', OPTIONS, async ($, on) => {
      setup(on, { remotes: A, active: 'acct-a' })
      expect((await $.tool.call(bash('GH_TOKEN=fake gh pr list'))).deny).toContain('GH_TOKEN')
      expect((await $.tool.call(bash('echo GH_TOKEN=x && gh pr list'))).deny).toBeUndefined()
    })
  })

  test('a failure inside the check refuses the call', OPTIONS, async ($, on) => {
    const w = setup(on, { remotes: B, active: 'acct-a', failProcess: true })
    expect((await $.tool.call(bash('git push'))).deny).toContain('its check failed')
    expect(w.ran).toEqual([])
  })

  test('an unclear call says so', OPTIONS, async ($, on) => {
    setup(on, { active: 'acct-a' })
    expect((await $.tool.call(bash('gh codespace list'))).deny).toContain(UNCLEAR)
  })
})
