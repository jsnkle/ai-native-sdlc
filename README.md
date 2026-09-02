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

This repo turns that into three things you can pick up separately.

## Three doors

| You want to... | Start here |
|---|---|
| **Understand the process** and explain it to a team | [`docs/`](docs/README.md), beginning with [why](docs/00-why.md) and the [artifact chain](docs/01-artifact-chain.md) |
| **Start a new project** on this process | `scripts/new-project.sh <dir> <name>`, which copies `plugin/template/` and points the project at the plugin |
| **Bring an existing project** onto this process | [`brownfield/`](brownfield/README.md), then run `/ai-native-sdlc:adopt` in the repo |

## How the repo is organised

The split follows one rule: anything shared across projects is a **plugin** that gets
installed, and anything specific to one project is a **template** file that gets copied.
That keeps every project on the same version of the shared pieces instead of drifting.

```
docs/              The methodology for humans. One file per play, plus roles, metrics,
                   adoption order and the source-of-truth decision.
plugin/            The Claude Code plugin every project installs: skills that write
                   intent, spec and plan; verifier, simplifier and researcher agents;
                   slash commands for each gate; the /adopt command; guardrail hooks.
plugin/template/   Per-repo files copied into a project: CLAUDE.md, REVIEW.md, the
                   intent/ artifact home, .claude/settings.json and project hooks, CI
                   workflows, evals, and the monitoring bands. It lives inside the
                   plugin so /adopt can copy from it wherever the plugin is installed.
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
`.claude/settings.json`, so teammates get it on their next session. The commands arrive
namespaced:

| Command | Play | What it does |
|---|---|---|
| `/ai-native-sdlc:intent` | Plan | Interview the originator and write `intent/<slug>/intent.md` |
| `/ai-native-sdlc:spec` | Design | Turn an accepted intent into `spec.md` with flagged concerns |
| `/ai-native-sdlc:plan` | Build | In plan mode, produce `plan.md` from the intent and spec |
| `/ai-native-sdlc:babysit-pr` | Deploy | Address review comments and failing checks until the PR is green |
| `/ai-native-sdlc:adopt` | Brownfield | Assess an existing repo and install the process step by step |

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
│   └── hooks/                production gate, protected paths, formatter
├── .github/workflows/        agent evals, spec-on-intent-merge, build triage
├── evals/                    the regression suite for the agent's configuration
└── ops/bands.yaml            control bands that close the loop
```

## Status

Version 0.1.0. The skeleton is complete and every example from the playbook has a home.
The policy skills, the eval cases and the monitoring bands are deliberately examples that
each organisation replaces with its own. See [`CHANGELOG.md`](CHANGELOG.md).
