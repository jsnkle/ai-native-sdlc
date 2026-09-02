# Closing the loop

Stage 6 of the AI-native SDLC. A deterministic script watches one metric and invokes Claude only
when a control band is breached. What Claude may do is set by the tier in `bands.yaml`, and
anything it proposes enters the repo as a pull request through the normal review gate.

| File | Role |
|---|---|
| `bands.yaml` | The metric, its window and baseline, and what each tier permits. Version-controlled config. |
| `detect.py` | Detection. Reads CI runs with `gh`, computes the statistic, prints a JSON report, exits with the tier. No model. Unit tested in `tests/test_detect.py`. |
| `loop.sh` | Acts on the tier: log, diagnose read-only, or propose an `intent.md` as a PR. Logs every run to `ops/log/`. |

## The statistic

The metric is the CI test failure rate. The statistic is the number of failures in the most
recent `window` completed runs, compared with the failure rate of the `baseline` runs before
them. The baseline rate is floored at `min_baseline_rate` so a clean history is not
zero-variance, otherwise a single failure after a perfect month would read as infinite sigma.
Cancelled, skipped and in-progress runs are not evidence. With `ignore_draft_prs: true` neither are
runs on draft pull requests, since a draft is where a red test legitimately lives; `ignore_branches`
excludes branch globs outright. Both were added after the first proposal the loop opened turned out
to be a work-in-progress branch, which is how a dismissal is meant to tune the bands.

`rules: western_electric` maps the sliding-window z-scores to tiers:

| Tier | Trigger | Action |
|---|---|---|
| 3 | latest window beyond 3σ, or two of the last three beyond 2σ | propose: diagnose, write `intent.md`, open a PR |
| 2 | latest window beyond 2σ, or four of the last five beyond 1σ | diagnose read-only, write the diagnosis to `ops/log/` |
| 1 | latest window beyond 1σ, or eight consecutive windows above the mean | log |
| 0 | within bands | nothing |

With the defaults (window 5, floor 0.05) two failures in five runs on a clean history is a
3σ breach; one failure is 1σ. A history that is already 40% failures absorbs two in five as
normal, which is the point: the bands track the repo's own baseline.

## Running it

```
ops/loop.sh                      # once, against this repo's CI history
.venv/bin/python ops/detect.py   # detection only, JSON on stdout, tier as exit code
```

Locally it runs under your Claude Code login. Unattended it runs from a scheduled workflow
with `ANTHROPIC_API_KEY` in repository secrets (a Console API key, which is billed separately from
a Claude subscription) and the repository setting that allows GitHub Actions to create pull
requests. Without that setting the propose step pushes its branch and then fails to open the PR. Triage the PRs it opens: fix now, schedule,
or dismiss. A dismissal should tune `bands.yaml`, and a fix should add an eval for the
incident so the configuration is regression-tested against it.
