# evals/ — regression tests for the agent configuration

CLAUDE.md, REVIEW.md, skills and hooks steer the agent, so they get the regression testing that code gets. Each file here is one eval: a prompt plus the checks that define acceptable. `.github/workflows/agent-evals.yml` runs the suite on any PR that touches that configuration, and nightly.

## Writing an eval

Collect 20 to 50 real tasks from recent work with their accepted outcome. For each, write `evals/<name>.json`:

```json
{
  "name": "add-endpoint",
  "prompt": "the task as an engineer would phrase it",
  "allowedTools": "Read,Edit,Bash(make test)",
  "checks": {
    "commands": ["make test", "make lint"],
    "files_changed_match": ["src/api/"],
    "files_unchanged": ["src/gen/"],
    "output_contains": ["make test"],
    "output_not_contains": ["skip"]
  }
}
```

- `commands`: each must exit 0 after the agent has run.
- `files_changed_match`: at least one changed file must match each prefix.
- `files_unchanged`: no changed file may start with these prefixes.
- `output_contains` / `output_not_contains`: substrings checked against the agent's final result text.

Every production incident gets an eval, written by the team that owned it, and stays in the suite as a regression test. As models improve, retire cases that no longer discriminate.

## Gate

A configuration change that drops the pass rate gets reviewed before it merges. The workflow exits non-zero on any failing eval; tighten to a percentage threshold once the suite is large.

## Running one locally

```sh
claude -p "$(jq -r .prompt evals/example-add-endpoint.json)" --allowedTools "Read,Edit,Bash(make test)" --output-format json > result.json
./evals/check.sh evals/example-add-endpoint.json result.json
```
