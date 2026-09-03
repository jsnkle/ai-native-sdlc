# AI-native SDLC

A working kit for running the software development lifecycle the way Anthropic's
[AI-Native SDLC playbook](https://claude.com/blog/the-ai-native-sdlc-playbook) describes it:
every stage ends by committing an artifact the next stage reads, agents do the work between
the gates, and humans decide at the gates.

The playbook's core idea is a loop rather than a line:

```
intent.md  →  spec.md  →  plan.md  →  diff + tests  →  PR + review findings  →  incident record
    ↑                                                                                  │
    └──────────────────────────────────────────────────────────────────────────────────┘
```

Every stage of that loop, including the unattended Maintain stage and the evals in CI, has
been run at least once on a sandbox repository. The
[retrospective](docs/retrospective-2026-09-03.md) records what was learned and scores each
play against the article.

## Four doors

| You want to... | Start here |
|---|---|
| **Understand the process** and explain it to a team | [`docs/`](docs/README.md), beginning with [why](docs/00-why.md) and the [artifact chain](docs/01-artifact-chain.md) |
| **Judge whether it works** before committing a team to it | The [retrospective](docs/retrospective-2026-09-03.md): lessons learned, a scorecard per play, and what to do next |
| **Start a new project** on this process | `scripts/new-project.sh <dir> <name>`, which copies `plugin/template/` and points the project at the plugin. `--with-example` keeps the worked `intent/_example/` chain; `--force` overwrites files that already exist |
| **Bring an existing project** onto this process | [`brownfield/`](brownfield/README.md), then run `/ai-native-sdlc:adopt` in the repo |

## How the repo is organised

The split follows one rule: anything shared across projects is a **plugin** that gets
installed, and anything specific to one project is a **template** file that gets copied.
That keeps every project on the same version of the shared pieces instead of drifting.

```
docs/              The methodology for humans. One file per play, plus roles, metrics,
                   adoption order, the source-of-truth decision, and the retrospective.
plugin/            The Claude Code plugin every project installs: skills that write
                   intent, spec and plan; verifier, simplifier and researcher agents;
                   a skill for each gate; the /adopt skill; an example policy skill;
                   guardrail hooks.
plugin/template/   Per-repo files copied into a project: CLAUDE.md, REVIEW.md, the
                   intent/ artifact home, .claude/settings.json and project hooks, the
                   CI workflows for every automated stage, the eval runner, and the
                   Maintain-stage detector, loop and bands. It lives inside the plugin
                   so /adopt can copy from it wherever the plugin is installed.
brownfield/        The runbook for adopting the process in an existing repository, in
                   dependency order, with a readiness assessment.
org/               What lives outside any repo: managed settings, permission policy,
                   and how to host this repo as a private plugin marketplace.
scripts/           new-project.sh, the greenfield bootstrap.
```

## Installing the plugin

This repository is itself a Claude Code plugin marketplace named `jsnkle`.

```
/plugin marketplace add jsnkle/ai-native-sdlc
/plugin install ai-native-sdlc@jsnkle
```

Projects created from `plugin/template/` already declare the marketplace and enable the plugin in
`.claude/settings.json`, so teammates get it on their next session. Every user-facing entry
point is a skill, invoked by name or triggered by its description in conversation:

| Skill | Play | What it does |
|---|---|---|
| `/ai-native-sdlc:intent` | Plan | Interview the originator and write `intent/<slug>/intent.md` |
| `/ai-native-sdlc:spec` | Design | Turn an accepted intent into `spec.md` with flagged concerns |
| `/ai-native-sdlc:plan` | Build | In plan mode, produce `plan.md` from the intent and spec |
| `/ai-native-sdlc:babysit-pr` | Deploy | Address review comments and failing checks until the PR is green |
| `/ai-native-sdlc:adopt` | Brownfield | Assess an existing repo and install the process step by step |

The plugin also ships three subagents (`verifier`, `simplifier`, `researcher`), two hooks that
block test edits during a fix task and keep credential shapes out of the diff, and
`secure-api-review`, the playbook's example policy skill that each organisation replaces with
its own. [`plugin/README.md`](plugin/README.md) maps each piece to the play it implements.

## Where things go in a project

```
your-project/
├── CLAUDE.md                 what a new joiner needs on day one; under a page
├── REVIEW.md                 the review passes and severity rules
├── intent/
│   └── <change-slug>/
│       ├── intent.md         what is wanted, why, under which constraints
│       ├── spec.md           requirements and design, policy applied, concerns flagged
│       └── plan.md           files that change, order of work, risks, proof
├── .claude/
│   ├── settings.json         plugin enabled, hooks wired, safe commands pre-approved
│   ├── protected-paths       the paths the agent may not edit
│   └── hooks/                production gate, protected paths, formatter
├── .github/
│   ├── CODEOWNERS            separation of duties: humans approve, the agent proposes
│   ├── pull_request_template.md
│   └── workflows/
│       ├── agent-evals.yml            re-run the eval suite when the agent's configuration changes, and nightly
│       ├── spec-on-intent-merge.yml   a merged intent opens a spec PR
│       ├── claude-review.yml          one comment-only review per PR, from REVIEW.md
│       ├── claude-mention.yml         @claude from a collaborator runs the fix loop
│       ├── triage-failed-build.yml    a red build gets a triage comment
│       └── closing-the-loop.yml       the scheduled Maintain-stage run
├── evals/                    run.sh, check.sh and the cases; the regression suite for the agent's configuration
├── ops/                      detect.py, loop.sh and bands.yaml: detection, tiered response, control bands
└── tests/test_detect.py      unit tests for the detector
```

[`plugin/template/README.md`](plugin/template/README.md) indexes every file with what to
customise, and describes the maturity ladder from running the skills by hand to letting each
accepted artifact trigger the next stage.

## Before switching on the automated stages

Everything under `.github/workflows/` that calls Claude needs `ANTHROPIC_API_KEY` in the
repository secrets, and the full chain (a workflow opening a PR that other workflows then act
on) needs `LOOP_GH_TOKEN`, because pushes made with the default Actions token trigger nothing.
Open the project in Claude Code once and accept the trust dialog before expecting the
permissions allow list to work; non-interactive runs never see it. Each automated run is a
Claude call with a price, so disable the workflows with `gh workflow disable` while a repo is
idle, as [docs/02-adoption-order.md](docs/02-adoption-order.md) describes.

## Status

Version 0.2.1. The kit is complete and has been exercised end to end on a sandbox: by hand,
then codified, then triggered from CI. The policy skill, the eval cases and the monitoring bands
are deliberately examples that each organisation replaces with its own. Known gaps are listed
per play in the [retrospective scorecard](docs/retrospective-2026-09-03.md#scorecard-against-the-article).
See [`CHANGELOG.md`](CHANGELOG.md) for what changed in each release.
