# tasks-band

A Claude Code mod that draws one thin band above the prompt showing how far through your `TASKS.md` checklist you are, and what is next.

## What this shows

```text
 TASKS 4/9 ▓▓▓▓░░░░░  next: Install blast-radius from the playground clone
```

- `done/total` and a short bar (one cell per item, up to 10 cells; a partly done list never shows as fully empty or full).
- The text of the first unchecked item, cut with `…` to fit the band's width.
- When every item is checked, the count and a full bar, with no "next".

It counts lines that look like a markdown checkbox, nested or not: `- [ ]`, `- [x]`, `- [X]`, or the same with `*`, `+`, or a numbered marker (`1.` or `1)`). Everything else in the file is ignored.

The band draws nothing when the file is missing or holds no checkbox items, and it yields when the engine is showing a survey.

| Hook | What it does |
|------|--------------|
| `session.start` | Reads the file, so the band shows before the first turn. |
| `turn.complete` | Reads it again after each main-loop turn (subagent turns are skipped). |
| `tool.call` on `Edit`, `Write` | When the target path ends in the task file's name, lets the edit run untouched, then reads the file again. |
| `ui.render` on `AbovePrompt` | Draws the band. |

The counts live in `$.state` (`tasks-band.tasks`), so a write redraws the band without a manual invalidate.

## Run it

**Requirements:** a Claude Code build with mods (2.1.295 was used), in a terminal or the desktop app. No accounts or environment variables.

**Install:**

```text
/plugin install tasks-band --marketplace jsnkle/ai-native-sdlc
```

Answer `y` to add the marketplace, choose a scope, and set the option below if you want a different file name.

**Option:** `file` (string, default `TASKS.md`) is the checklist to read, relative to the session's working directory.

**Try it from a clone, for one session:**

```bash
claude plugin validate ./mods/tasks-band
claude --plugin-dir ./mods/tasks-band
```

**Test it:**

```bash
claude plugin test ./mods/tasks-band
```

The tests run on both the `terminal` and `desktop` surfaces.

## Notes / limitations

- The file is read from the session's working directory only, not searched for upward.
- The band refreshes on session start, after each main-loop turn, and after an `Edit`/`Write` of the file. A change you make in an editor outside the session shows after the next turn.
- Only the first line of an item counts as its text, shown as plain text (links, backticks, `**` and `~~` are stripped, control characters become spaces). A checkbox with no text counts toward the total but is never chosen as "next".
- One band per session: another plugin that draws `AbovePrompt` competes for the same slot.
- The band is a single line of text; it has no buttons.

## Dependencies

| Name | Version | License (SPDX) | Source |
| --- | --- | --- | --- |
| None | | | |

## Third-party notices

None.
