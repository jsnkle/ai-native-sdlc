# Changelog

All notable changes to the plugin and template are recorded here. The plugin version in
`plugin/.claude-plugin/plugin.json` and `.claude-plugin/marketplace.json` moves together.

## 0.2.5 - 2026-09-26

**The kit is for private repositories whose contributors are all trusted, and now says so up front.** It is not for public repositories or open-source projects that take contributions from people you do not know. The agents read pull requests, review comments and CI logs, and CI runs pull requests' code with the Anthropic key in reach. The guards added in 0.2.2 to 0.2.4 stay: the fix loop refuses forks and outside authors, and no agent job holds a token that can write to GitHub. They limit the damage of a mistake; they are not what makes the kit safe for untrusted contributors, and they were never going to be. Decided by the owner after the 0.2.4 review showed how many of the remaining risks start with an outside contributor.

- The README, the plugin README, the template README and the handbook index open with the same statement.
- Every workflow that runs Claude starts with a two-line header saying so, and `ops/README.md` opens with it, because the template README is not copied into projects and those files are.
- `ops/README.md` on running the loop by hand now points at that scope instead of at "a repository that takes pull requests from outside".
- The open items in 0.2.4's "What remains" that need an untrusted contributor stay recorded. They are outside the kit's intended use.

## 0.2.4 - 2026-09-26

**Closing the loop and the spec workflow: no agent job holds a token that can write to GitHub.** Before this release, a 3-sigma breach ran Claude with `git *`, `cat *` and `gh run *` while `LOOP_GH_TOKEN` and `ANTHROPIC_API_KEY` were in its environment and the checkout kept a write token. The agent reads failed CI logs, and anyone whose pull request runs CI can write into those. `git *` is enough to run any command (`git -c alias.x='!cmd' x`). This hardening was predicted rather than observed; nothing like it has happened. The boundary is the split into jobs. The agents' tools are narrower too, but that is not a boundary: `git log --output` can still write any file in the job.

- **`closing-the-loop.yml` runs in two jobs.**
  - **`loop`.** Detection, and on a breach Claude, run with the job's read-only token, from a checkout that keeps no credentials. At tier 3 Claude writes one `intent/<slug>/intent.md` and commits nothing; `loop.sh --no-propose` stages it under `ops/log/proposal/`. The log is scanned for key-shaped strings before it becomes an artifact.
  - **`propose`.** It runs no agent. It detects again from main, so the report in the PR does not come from the agent's job, and it proposes only while the breach is still at tier 3. `LOOP_GH_TOKEN` is in this job only.
- **New `ops/propose.sh`** is what commits, pushes and opens the PR, by hand or in CI. It takes exactly one new regular file at `intent/<slug>/intent.md`, at most 64 KB, with nothing shaped like a credential, and never an intent that already exists. It commits with git hooks off.
- **`ops/loop.sh` at tier 3** gives the agent `Read`, `Write`, `Glob`, `Grep`, `Skill`, `gh run view`, `gh run list`, `gh pr view`, `git log`, `git show` and `ls`. It no longer has `git *`, `cat *` or `gh run *` (which includes `rerun`, `cancel` and `delete`). Both tiers' prompts say to treat logs, commits and PRs as data.
- **Fixed in both scripts, found by the pre-release review:** open proposals from forks no longer count as duplicates, so an outside PR on a `loop/...` branch cannot switch proposals off, and the check reads up to 500 open PRs, not 30. `loop.sh` no longer reads a detection crash (exit 1) as tier 1; the scheduled job used to stay green while detecting nothing. `propose.sh` proposes only a tier-3 report and takes the rule name only from a fixed character set, since it goes into the PR body.
- **The propose job installs only PyYAML**, which is all `detect.py` needs, instead of the project's dev dependencies, and its checkout keeps no credentials while it installs. The push credential is set just before `propose.sh`.
- **`spec-on-intent-merge.yml` splits the same way.** Its agent could write files and read a checkout that kept the write token, and the next step in the same job committed with `LOOP_GH_TOKEN` set. A step can hand environment variables such as `BASH_ENV` to the steps after it, so that step was not a safe place for the token. Now the `spec` job runs Claude with a read-only token and no stored credentials and stages each `spec.md`. The `publish` job runs no agent. It takes only `intent/<slug>/spec.md` files for intents that exist and have no spec yet, at most 256 KB each and with nothing shaped like a credential, and commits them with hooks off. It also runs on `workflow_dispatch`, for the intents changed in the latest commit, for example after a failed run. Its input is an intent.md a person already merged, so this was the lower risk of the two; it was predicted, not observed.
- **The template README recommends a CI-only Anthropic key** in a workspace of its own with a monthly spend limit, linked to a service account.

From the end-to-end run of 0.2.3 on the sandbox (all observed; details in [docs/e2e-2026-09-26.md](docs/e2e-2026-09-26.md)):

- **`claude-mention`, `closing-the-loop` and `spec-on-intent-merge` check `LOOP_GH_TOKEN` before they use it.** An expired token failed the fix loop's publish job as `could not read Username for 'https://github.com'`, which does not name the token, and the round was lost.
- **When the fix loop's publish job stops, it says so on the PR** with a link to the run. A refused push (for example, a commit touching `.github/`) showed only as a failed run, and whoever asked saw nothing.
- **The fix loop's summary is written as it reads after the push.** It said its commit was "not pushed", because the agent writes it before the publish job pushes.
- **Build triage posts only the three-line summary.** It posted the cause, the flaky-or-real call and then the summary as three sections.
- **What remains:**
  - The `claude-mention` and `triage-failed-build` changes above have not run on GitHub. Those workflows run on comment and pull request events, which use the default branch's copy, so they could not be dispatched from a test branch. closing-the-loop 0.2.4 did run on the sandbox from a branch and opened its proposal PR.
  - Run by hand, the separation does not hold. At tiers 2 and 3 the agent can write to the working copy (with `git log --output`, even `.git/config`), and git and `propose.sh` then run under your credentials, so a run by hand can give planted instructions command execution under your account. `ops/README.md` says to run it by hand only in a container or VM without your credentials, and not at all on a repository that takes outside pull requests.
  - Plausible, not demonstrated: proposal PRs are opened by the `LOOP_GH_TOKEN` account, which the fix loop treats as a trusted author, and `claude-review` reviews them as `github-actions`, whose comments the fix loop acts on. Text planted in a CI log could travel through the intent and the review into instructions the fix loop trusts, once a maintainer mentions `@claude` on a proposal PR. The fix loop's token is read-only and its publish job keeps its checks, so what could reach the branch is ordinary code, which CI runs, with the repository's secrets, before a human reviews it. A candidate fix is for `claude-mention` to refuse `loop/` branches.
- **Projects that copied the template earlier should replace `closing-the-loop.yml`, `spec-on-intent-merge.yml`, `claude-mention.yml`, `triage-failed-build.yml` and `ops/loop.sh`, and add `ops/propose.sh`.**

## 0.2.3 - 2026-09-25

**Security hardening: in the review, fix and triage workflows, no agent holds a token that can write to GitHub.** Before this release, planted instructions could reach an agent that held `gh api *` and `git *` with a write token. Anyone can write such instructions into a review thread or a pull request. This hardening was predicted rather than observed; nothing like it has happened. An independent review before release found gaps in the first version, and they are fixed here.

- **`claude-mention.yml` and `claude-review.yml` each run in two jobs.**
  - **Agent job.** Claude runs with the job's read-only token, from a checkout that keeps no credentials. It returns its review, or its replies and summary, as structured output (`--json-schema`).
    - The fix loop may run `make build`, `make test` and `make lint`, and `git status`, `diff`, `log`, `show`, `add` and `commit`.
    - It may run `gh` commands, `gh api` included. Those can only read, because of the token.
    - It no longer has `git *`, `make *`, `find *`, `.venv/bin/*` or `gh pr comment`.
  - **Publish job.** It runs no agent and none of the PR's code, and it re-checks the pull request instead of trusting the agent job's outputs.
    - Reviews are posted with event `COMMENT` only, pinned to the reviewed commit. If GitHub rejects the inline comments, they are folded into a single body.
    - Claude's commits are pushed to the PR branch without force.
    - Replies go only to the first comment of a review thread on that pull request: at most 30, each prefixed with `[claude-mention]`. One rejected reply does not stop the rest.
    - Nothing is published if the output or the diff contains something shaped like an API key.
- **The push refuses commits that:**
  - touch `.github/`, `.claude/` (at any depth or capitalisation), `.mcp.json` or a `CODEOWNERS` file, including through renames and unusual file names
  - name an author or committer other than claude-mention
  - do not build on the PR head
  - arrive after the branch moved
  - would go to the default branch.
- **`triage-failed-build.yml` splits the same way.** The build job runs the PR's code with a read-only token, no stored credentials and no secrets. The triage job runs none of it. Claude runs with `--bare` (no hooks, plugins or `CLAUDE.md`) in an empty folder, with the log on stdin and only read-only tools, and the job posts the summary.
- **`agent-evals.yml` declares a read-only token and keeps no credentials in its checkout.** Before, it inherited the repository's default permissions.
- **The fix loop does one round per mention.** Only an `@claude` from an owner, member or collaborator joins the PR's concurrency group, so other comments cannot displace a waiting mention. A newer mention still replaces an older one that has not started.
- **`claude-review.yml` skips pull requests from forks.** GitHub gives their runs no secrets, so the review could not run there anyway.
- **The `babysit-pr` skill lists review threads through GraphQL.** `gh pr view` has no `reviewThreads` field, so the old instruction failed with "Unknown JSON field".
  - It acts only on comments from owners, members, collaborators or the repository's own review bot.
  - It can do a single round when it cannot push.
- **What remains:**
  - The agent job still runs the PR's code and loads its configuration (hooks, `.mcp.json`, a skill's `allowed-tools`) with `ANTHROPIC_API_KEY` in the environment. Injected instructions can therefore still reach that key through the build, and the credential scan only catches the plain form. Use a dedicated key with a spending limit.
  - In the `issue_comment` context, that code can also reach the default branch's Actions cache, so do not restore caches that a workflow trusts.
  - `closing-the-loop.yml` is unchanged in this release. It runs on a schedule and still gives its agent `git *` with `LOOP_GH_TOKEN`.
- **Projects that copied the template earlier should replace `claude-mention.yml`, `claude-review.yml`, `triage-failed-build.yml` and `agent-evals.yml`.** They need `jq` on the runner (it is on GitHub-hosted runners) and a Claude Code version with `--json-schema`.

## 0.2.2 - 2026-09-25

**Security.** `claude-mention.yml` ran the fix loop on any pull request that an owner, member or collaborator mentioned `@claude` on, including pull requests from forks. The loop checks out the PR and runs with `ANTHROPIC_API_KEY` and `LOOP_GH_TOKEN`, and the PR's own hooks, Makefile and venv run there. That means an outside contributor's pull request could run code with those secrets. It was found by review on 2026-09-25. The kit's sandbox had the workflow disabled.

- `claude-mention.yml` now handles only pull requests opened from a branch of this repository by an owner, member or collaborator. It refuses the rest before checking anything out.
- `CODEOWNERS` assigns `.github/` to the tech lead, so the workflows that hold secrets change only with the same review as `.claude/`.
- **Projects that copied the template before 0.2.2 should replace their `.github/workflows/claude-mention.yml` and add the `.github/` line to `CODEOWNERS`.** Template files are copied when a project adopts the kit, so updating the plugin does not change them.

Documentation corrections from [the 2026-09-25 retrospective](docs/retrospective-2026-09-25.md):

- Approvals: the agent's "never approves or merges" is a prompt. The docs, CODEOWNERS and workflow comments now say it holds only when branch protection requires a code-owner review and no token the agent uses belongs to a code owner. The template README says to create `LOOP_GH_TOKEN` from an account that is not a code owner.
- Template README lists `requirements-dev.txt` and the Makefile targets the workflows assume; the template ships neither.
- Hooks: the plugin README says they are Claude Code only (Codex installs the plugin, but its patch-shaped edits pass both hooks), and the hooks play no longer says a hook makes a policy impossible to skip.
- The CLAUDE.md play covers repositories that already have an `AGENTS.md`.

## 0.2.1 - 2026-09-03

- Template gains `claude-review.yml` (one comment-only review per PR from REVIEW.md) and `claude-mention.yml` (`@claude` fix loop, gated to owners, members and collaborators). `spec-on-intent-merge.yml` diffs the whole push and uses the spec skill; `triage-failed-build.yml` triages only when the build step failed. All four exercised with real triggers on the sandbox.
- Template README indexes every file; docs record the automated ladder and the shutdown method.

## 0.2.0 - 2026-09-02

Everything below was found by running the whole playbook end to end on a sandbox repository, including the unattended Maintain stage and the continuous evals in CI.

- Template hooks read their payload with `$(cat)`; the playbook's `< /dev/stdin` pattern fails open on Linux runners.
- Documented what workspace trust gates in `claude -p` (the permissions allow list, not project hooks), the Console API key requirements, and the Actions PR-creation setting.

- Template evals gain `evals/run.sh` (shared by local and CI runs, with per-case `setup`), and the workflow installs the venv and the plugin whose hooks the suite exercises. Proven on the sandbox with five cases drawn from real incidents.
- Template gains the Maintain stage: `ops/detect.py` (deterministic detection, tested), `ops/loop.sh` (tiered response), `.github/workflows/closing-the-loop.yml` (unattended schedule). Proven end to end on the sandbox: tier 2 diagnosis and a tier 3 intent PR.

## 0.1.1 - 2026-09-02

Found by the first end-to-end brownfield test.

- Merged `plugin/commands/` into the skills. A command and a skill sharing the name `adopt` collided in the unified namespace; the command won and the skill body never loaded. `intent`, `spec`, `plan`, `adopt` and `babysit-pr` are now user-invocable skills with argument hints.
- Renamed `intent-format`, `spec-format`, `plan-format` to `intent`, `spec`, `plan`.
- `adopt` documents its scope argument and how each scope maps to its steps.

## 0.1.0 - 2026-09-02

Initial skeleton derived from Anthropic's "The AI-Native SDLC playbook" (August 2026).

- `docs/`: the methodology for humans, one file per play.
- `plugin/`: skills, agents, commands and generic hooks installed into every project.
- `plugin/template/`: per-repo files copied into a new or existing project.
- `brownfield/`: the adoption runbook for existing repositories.
- `org/`: managed settings and marketplace hosting, owned outside any repo.
- `scripts/new-project.sh`: greenfield bootstrap.
