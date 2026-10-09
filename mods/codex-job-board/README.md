# Codex Job Board

A Claude Code mod that keeps track of the OpenAI Codex CLI runs Claude starts from Bash. A long `codex exec` run in the background can take ten minutes or more, and its output is out of sight. This mod shows how many runs are going on the status line, and lists each run in a `/codex` pane with the session id you need to resume it, the time it took, whether it finished, how many tokens it used and how full its context is.

## What this shows

While at least one run is going, the status line reads:

```text
codex 1 running 12m
```

`/codex` opens a pane with one row per run started in this session. The pane also opens by itself the first time a run finishes, if the terminal has room to place it.

```text
session  model         time   status  tokens  ctx  report
6c148ada gpt-6-astra   4m     done    734.5K  42%  out/review.md
9c01d7e2 gpt-5.6-sol   38s    running 81.2K   8%   out/second.md
```

- **session**: the last 8 characters of the Codex session id. Codex ids are UUIDv7, so their first characters are a timestamp and repeat for runs started within a minute of each other. The `/codex` command's output lists the full ids, ready for `codex exec resume <id>`.
- **time**: elapsed while running, the run's length once finished.
- **status**: `pending` while the Bash call waits (for a permission prompt, say), then `running`, `done` or `failed`.
- **tokens**: `total_token_usage.total_tokens` from the run's last `token_count` event. It is cumulative over every turn of the Codex session, so a resumed session's figure includes the earlier runs.
- **ctx**: how full the context is: `last_token_usage.total_tokens` over `model_context_window`, both from that same event. This is the figure to watch for context rot.
- **report**: the `-o` path, as written in the command.

The mod only watches. It never blocks, delays or rewrites a Bash call, and it settles a finished call's job after the result has gone back to the model.

The patterns it demonstrates:

- Observing `tool.call` for Bash and always passing the call on, with a `.catch` so a failure in the mod can never stop the call.
- Finding the completion of background work from files another program writes, on a `$.clock.every` timer that runs only while there is work to watch, and that `session.start` starts again from `$.state` after a hot reload.
- A `/codex` slash command, a `Pane` and a status-line entry, all drawn from the same `$.state` value.

## Demo

No screenshot yet. The two blocks above show the status line and the pane's layout.

## How it was built

- **Model:** Claude in Claude Code.
- **Prompt(s):** a brief from a lead agent: watch Bash calls containing `codex exec`, correlate each to its Codex rollout file, show a status line while a run is going and a `/codex` pane listing the runs; observe only. A second round applied an independent review.
- **Transcript:** not shared.
- **Iterations:**
  - The finishing marker came from counting event types in real rollout files written by `codex exec` (originator `codex_exec`). Each finished turn has a `task_started` and a `task_complete`. Interrupted runs end in `turn_aborted`, or stop with no closing event.
  - Rollout files of long runs are several megabytes, more than one `$.fs.read` takes, so the mod reads only the lines it needs through `grep`.
  - `codex exec resume` appends to the original rollout file. Only events after the call's start count toward that call's status, and a finished job's file can be claimed again by a later resume.
  - The review found that the first percent used the cumulative total. On a real run that showed 70% where the context was 42% full, and a resumed session could pass 100%. The percent now comes from the last request and the window Codex reports.
  - The first process check matched `codex exec-server`, which the ChatGPT desktop app keeps running. The check now needs a space or the end after `exec`.
  - A permission prompt is part of the Bash call. Jobs now stay `pending` and get no verdict until the call is under way.

## Run it

**Requirements:**

- Claude Code with function-hook mods (built and tested on 2.1.295).
- The Codex CLI, writing its sessions under `~/.codex` (or `$CODEX_HOME`).
- macOS or Linux: the mod runs `find`, `head`, `grep` and `pgrep`.

No options and no environment variables.

**Steps:**

1. Install it at a terminal prompt:

   ```text
   /plugin install codex-job-board --marketplace jsnkle/ai-native-sdlc
   ```

   Answer `y` to add the marketplace, then pick a scope.

2. Have Claude run a Codex job, for example in the background:

   ```text
   codex exec -m <model> -s read-only -C <dir> --color never -o <report.md> - < <prompt.md>
   ```

3. Watch the status line, and type `/codex` to see the board.

To try it from a clone without installing: `claude --plugin-dir mods/codex-job-board`.

## What it detects

- **A job**: a Bash call whose command runs `codex exec` where a command starts. That is the start, or after `;`, `&&`, `|`, `(`, `{`, `$(`, a newline, `then`, `do` or `else`. `nohup`, `time`, `sudo`, `env [-u NAME]`, `timeout N` or `VAR=value` may come first, and the binary may be named or given by path. Quoted strings and heredoc bodies are skipped, so `grep "codex exec" notes.md`, `echo "a; codex exec b"`, `git commit -m '(codex exec later)'` and a heredoc line that starts with `codex exec` are not jobs.
- **What the job records**: the command; `-m`/`--model`; `-o`/`--output-last-message`; `-C`/`--cd`, or a `cd <dir> &&` before the call; the id after `codex exec resume`, or `--last`; the start time; whether the call ran in the background.
- **Its rollout file**:
  - For `resume <id>`: the file under `sessions/` whose name ends in that id.
  - For a new run: the earliest rollout file in the date folders around the start that was created after the call started and that no open job has claimed. Its first line must say `codex_exec` wrote it in the job's directory (the `-C` directory, else the `cd`, else the session's, with symbolic links resolved). When `-m` is given, its first `turn_context` must name that model. So runs from the Codex desktop app, from a terminal elsewhere, or with another model are not claimed.
  - For `resume --last`, or a resume id with no file of that name: the most recently created matching file from before the call that has been written since.
- **Pending**: from the call until it is under way. A background call is under way when the Bash tool returns; its start time is then taken again, so a permission prompt does not count toward the run's time. A foreground call is under way once its rollout file appears. A call that comes back as an error with no rollout file (for example, refused at the permission prompt) is dropped.
- **Done**:
  - the rollout file has a `task_complete` event after the call started; or
  - the `-o` report file was written after the call started, the rollout file has been quiet for 30 seconds, and no `codex exec` process is left; or
  - a foreground Bash call returned without an error.
- **Failed**:
  - the rollout file has a `turn_aborted` event after the call started; or
  - the rollout file has been quiet for 30 seconds (or never appeared), no `codex exec` process is left, and there is no fresh report; or
  - a foreground Bash call returned an error. The reason given is the last `error` event when there was one.

  An `error` event alone is not a verdict, because Codex carries on after some errors.
- **Background**: a call made with `run_in_background`, or one the Bash tool moved to the background (its result carries a background task id, as after a timeout or Ctrl+B). These are followed from Codex's files every 10 seconds while any job is open. A job settled by the quiet rule is looked at again for 5 minutes, and is reopened if its rollout file grows.

## What it does not detect

- A run started any other way: from a terminal, a script Claude runs (`./review.sh`), or another session.
- `codex exec` inside quotes (`bash -c "codex exec ..."`), a variable, an alias or a shell function, or backgrounded inside the command with `&`. The last one returns at once, so it is marked done when the Bash call returns.
- Two new runs started together in the same directory on the same model (or with no `-m`) cannot be told apart. They get the files in the order the files were created.
- The process check is machine-wide and best effort. While any `codex exec` runs, a job whose run died stays `running` until its rollout file settles it, or that other run ends.
- A `cd` is read only when it comes directly before the codex call, joined by `&&` or `;`.
- An `error` event has not been seen in a real rollout file. The mod uses it only to name a failure.
- Model names are not looked up. The model is what `-m` says (`default` when absent).
- Jobs are kept for the session only (the last 50), in `$.state`. They survive a hot reload of the mod, not a restart.

## Notes / limitations

- The pane opens unasked only once per session, and only where it can be placed (a wide enough terminal). Otherwise use `/codex`.
- Times use Claude Code's clock for the start, and the rollout's own timestamps for the finish when it has one.

## Dependencies

| Name | Version | License (SPDX) | Source |
| --- | --- | --- | --- |
| None | | | |

## Third-party notices

OpenAI and Codex are trademarks of OpenAI; use here is descriptive and implies no endorsement.
