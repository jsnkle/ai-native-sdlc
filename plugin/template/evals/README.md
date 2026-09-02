# evals/ — regression tests for the agent configuration

CLAUDE.md, REVIEW.md, skills and hooks steer the agent, so they get the regression testing that code gets. Each file here is one eval: a prompt plus the checks that define acceptable. `.github/workflows/agent-evals.yml` runs the suite on any PR that touches that configuration, and nightly.

## Writing an eval

Collect 20 to 50 real tasks from recent work with their accepted outcome. For each, write `evals/<name>.json`:

```json
{
  "name": "add-endpoint",
  "prompt": "the task as an engineer would phrase it",
  "allowedTools": "Read,Edit,Bash(make test)",
  "setup": ["touch .claude/fix-task"],
  "checks": {
    "commands": ["make test", "make lint"],
    "files_changed_match": ["src/api/"],
    "files_unchanged": ["src/gen/"],
    "output_contains": ["make test"],
    "output_not_contains": ["skip"]
  }
}
```

- `setup`: shell commands run before the agent, to stage the situation (a marker file, an injected bug).
- `commands`: each must exit 0 after the agent has run.
- `files_changed_match`: at least one changed file must match each prefix.
- `files_unchanged`: no changed file may start with these prefixes.
- `output_contains` / `output_not_contains`: substrings checked against the agent's final result text.

Every production incident gets an eval, written by the team that owned it, and stays in the suite as a regression test. As models improve, retire cases that no longer discriminate.

## Gate

A configuration change that drops the pass rate gets reviewed before it merges. The workflow exits non-zero on any failing eval; tighten to a percentage threshold once the suite is large.

## Running locally

```sh
evals/run.sh                          # the whole suite, under your Claude Code login
evals/run.sh evals/one-case.json      # a subset
```

`run.sh` needs a clean working tree, runs each case's optional `setup` commands first, then the agent, then `check.sh`, and resets the tree between cases. The workflow calls the same script, so local and CI runs are identical apart from the credential.

Expect the first run of a new case to find a bug in the case rather than in the agent: a fix that restores a file byte-for-byte shows no diff, so assert content rather than `files_changed_match`; and forbidding changes under `intent/` contradicts a CLAUDE.md that says every change starts there.
