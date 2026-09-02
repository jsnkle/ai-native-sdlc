---
name: adopt
description: Brownfield adoption of the AI-native SDLC in an existing repository. Use when asked to adopt, install, bootstrap or set up the AI-native SDLC, the intent/spec/plan artifact chain, CLAUDE.md, REVIEW.md or the SDLC hooks in a project that already has code.
argument-hint: "[assess | claude-md | intent | hooks | review | all]"
---
Invoked as `/ai-native-sdlc:adopt [scope]`. Scope is `$ARGUMENTS`, default
`assess`, which changes nothing. Scopes map to the steps below: `assess` runs
step 0 only; `claude-md` runs 0 and 1; `intent` runs 0 and 2; `hooks` runs 0
and 3; `review` runs 0 and 4; `all` runs 0 to 5 in order. Every scope ends
with the step 6 report.

# Adopt the AI-native SDLC in an existing repo

You do the mechanical half of the brownfield runbook (`brownfield/README.md`
in the ai-native-sdlc repo). The human half, deciding the source of truth and
which gates must survive, stays with the tech lead. Walk the play dependency
graph in order; each step is independently shippable as its own PR.

**Never overwrite an existing file without showing the diff and getting a
yes.** Existing conventions win over the template.

The template files ship with this plugin at `${CLAUDE_PLUGIN_ROOT}/template/`
(the same tree as `plugin/template/` in the ai-native-sdlc repo). Every
"from the template" below means copy from there, then adapt to what the
assessment found.

## Step 0: Assess

Gather and report before changing anything:

- Build, test and lint: is there a single command for each that exits
  non-zero on failure? (Makefile, package.json scripts, pyproject, Gradle.)
- `CLAUDE.md`: present? Under a page? Has Commands, Conventions, Architecture,
  Things Claude gets wrong, Verifying your work?
- `.claude/`: settings, hooks, skills, agents already there?
- CI: which platform, do workflows exist, is there a review step?
- Branch protection and CODEOWNERS (`gh api repos/{owner}/{repo}/branches/main/protection` if `gh` is authenticated; otherwise ask).
- Existing record system: Jira keys in commits, ticket links in PRs, a
  requirements tool. This decides the `Record:` line in artifacts.
- Test file layout, so the protect-tests hook patterns match.

Write the assessment as a short table: item, found, gap.

## Step 1: CLAUDE.md (no prerequisites)

If absent, run `/init`, then cut the result to what a new joiner needs on day
one. Keep exactly these sections, under a page in total:

`# <Project>` / `## Commands` / `## Conventions` / `## Architecture` /
`## Things Claude gets wrong` / `## Verifying your work`

Commands list each with an example of healthy output. Verifying your work
says: run build, test, lint before reporting done, paste the output, fix the
code not the test. If CLAUDE.md exists, propose additions as a diff only.

## Step 2: The artifact home (no prerequisites)

Create `intent/README.md` from the template, explaining one folder per change
holding `intent.md`, `spec.md`, `plan.md`, and the `Record:` linkage rule the
tech lead chose. Do not create example artifacts.

## Step 3: Plugin and hooks

Claude Code guards writes under `.claude/`, so a non-interactive session may
not be allowed to change `settings.json` or add hooks. If a write there is
refused, do not stop: write the whole step as `adopt-step3-hooks.patch` at
the repo root, check it with `git apply --check`, and tell the user to run
`git apply adopt-step3-hooks.patch && rm adopt-step3-hooks.patch`.

Add or merge `.claude/settings.json` so it enables `ai-native-sdlc@jsnkle`
(`enabledPlugins`) and registers the marketplace
(`extraKnownMarketplaces`). Copy `.claude/hooks/production-gate.sh` and
`protected-paths.sh` from the template and wire them as `PreToolUse` on
`Bash` and `Write|Edit`. Ask which paths are protected (generated code,
frozen packages, migrations, infra).

## Step 4: REVIEW.md (needs CLAUDE.md)

Add `REVIEW.md` at the root from the template: Passes (bugs, security,
compliance against spec.md and plan.md), what Important means, cap the nits,
do not report. Fill *Do not report* from the assessment (generated paths,
what CI already enforces).

## Step 5: Offer the later plays

Do not install these unprompted. List them with what each needs:

- `.github/workflows/agent-evals.yml` + `evals/` (needs CI able to run
  `claude -p` and an API key with budget).
- `.github/workflows/spec-on-intent-merge.yml` (turns intent acceptance into
  an automatic spec PR; needs the review gate first).
- `ops/bands.yaml` + a detection script (closing the loop; needs PR review,
  approval hooks and a rehearsed rollback).
- Managed settings from `org/` (owned by the platform team, not this repo).

## Step 6: Adoption report

Finish with a report the tech lead can paste into the adoption PR: what was
added or changed (paths), what was left untouched and why, which plays are now
in place, which remain and their prerequisites, and the decisions still owed
by a human (source of truth, protected paths, which gates survive).
