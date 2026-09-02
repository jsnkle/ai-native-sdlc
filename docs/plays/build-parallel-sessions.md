# Parallel sessions and subagents

Stage 3, Build. One engineer can drive several streams of work at once. The engineer's job shifts from writing to steering and reviewing.

## What changes

**Traditional.** One engineer works one task at a time and spends a significant part of the day waiting on builds, tests, and reviewers. Switching tasks while waiting is possible, but the context switch is tiring enough that few people choose to.

**AI-native.** One engineer runs several Claude Code sessions at once, each in its own git worktree on its own task. Repeated jobs become subagents with their own context and tool limits. The engineer orchestrates, and eventually builds and monitors loops.

Two distinct things:

- A **parallel session** is another full Claude Code instance working a separate task in its own worktree. Sessions know nothing about each other; the engineer is the only thing they share.
- A **subagent** runs inside a single session as a scoped helper with its own context window and tool limits. It suits jobs that recur across tasks, such as verifying the app runs as expected.

Parallel sessions raise the number of tasks in flight. Subagents keep each session focused on its own task.

## Who runs it

The engineer.

## Prerequisites

`CLAUDE.md`, since every session reads it ([build-claude-md.md](build-claude-md.md)). The feedback loop helps ([test-feedback-loop.md](test-feedback-loop.md)), because a session that can verify its own work needs less supervision.

## Infrastructure

A git repository, since isolation comes from worktrees. Permission settings tuned so sessions are not waiting on approval prompts for commands the organization considers safe.

## How to execute it

1. Split the work into tasks that touch different files. The plan from [build-plan-mode.md](build-plan-mode.md) shows where the work is independent. Tasks that share files run in one session, one after another.
2. Give each parallel task its own worktree: `claude --worktree feature-auth` in one terminal, `claude --worktree fix-rate-limit` in another. A worktree is a separate checkout on its own branch, so sessions do not collide on files.
3. Start with two or three sessions. The practical ceiling is how many streams one person can review properly. Add sessions only while review keeps up.
4. Turn repeated jobs into subagents: markdown files with a name, a description of when to use it, and the tools it may touch. Check them into git so the whole team shares them.

## What it looks like

Three subagents ship in the plugin at `plugin/agents/`: `verifier` runs the app and checks the change against `plan.md` without fixing anything, `simplifier` strips needless complexity after the main agent finishes, and `researcher` explores the codebase and reports back without flooding the main context. The article's verifier is the model:

```markdown
---
name: verifier
description: Runs the app and checks the change works before the session reports done
tools: Bash, Read
---
Start the app with make run. Exercise the changed behavior and the two nearest
neighboring flows. Report what you ran, what you saw, and any behavior that does
not match plan.md. Do not fix anything; report only.
```

## Governance

More sessions means more output, so the controls have to come from configuration in the repo. Hooks and permission settings there apply to every session. What a session does is logged and attributed to the engineer who ran it.

## How to measure it

- **Leading.** Concurrent sessions per engineer while review quality holds, from the OpenTelemetry export, and the share of the day spent steering rather than waiting.
- **Lagging.** Changes merged per engineer per week, read alongside the rework rate from PR history.
