# gh-account-guard

A Claude Code mod that stops a `gh` or `git push` call from running on the wrong GitHub account by accident. `gh auth switch` changes the account for every repo at once, and on the wrong account `gh` doesn't say "wrong account": it says the repo doesn't exist, and a push fails or lands under the wrong name. This mod catches that before the call runs.

## What this shows

When Claude runs a shell command (the Bash or Monitor tool) that contains `gh` or `git push`, the mod reads every `gh` and `git push` in it. For each one it works out which repo owner it targets and which account it will use, and checks them against rules you set.

- **All of them match:** the call runs. Nothing is shown.
- **Any of them doesn't:** Claude Code's own question dialog asks what to do:
  - **Switch to `<account>` and run** runs `gh auth switch --user <account>`, then runs the call unchanged.
  - **Run anyway** runs the call as it is.
  - **Cancel** refuses the call. Claude is told both account names and the `gh auth switch --user …` to run, and is asked to run it only if you agree.
- **Switch isn't offered** in these cases:
  - no rule names an account for the owner;
  - no `gh` account is active;
  - the call runs with a token;
  - the command switches accounts itself;
  - parts of the command need different accounts.
- **Anything other than the three answers refuses the call:** a typed answer (Claude sees it), a dismissed dialog, or a session with nobody to ask (`claude -p`).

**When the mod can't tell, it asks.** A false question costs one click; a silent pass is what the mod exists to prevent. It asks when:

- a remote can't be read, or gives an empty or unreadable URL;
- git has no push destination for the branch;
- the command changes remotes, or overrides git config that decides where or as whom it pushes;
- a call names two owners;
- the command sets `GH_HOST`, `GH_CONFIG_DIR` or an enterprise token;
- a `gh` command writes without naming an owner (`gh repo create name`, `gh gist create`, `gh ssh-key add`), or is one it doesn't know;
- `gh api` uses `graphql`, writes without naming an owner, or sends its own `Authorization` header;
- `gh` or `git push` runs inside `bash -c`, `eval`, `xargs`, `find -exec`, `ssh`, `$(...)` or backticks.

Shell commands without `gh` or `git` in them aren't looked at. Commands that never touch an account's data pass: `gh auth status`, `gh --version`, `gh help`, `gh config`, `gh search`, `gh status`, `gh repo list`, `gh api user`, a plain `gh api` GET with no owner, and anything with `--help`. A mention in `echo`, `grep`, a comment or a quoted PR body passes too.

**Which repo owner.** For each `gh` or `git push` in the command:

1. For `gh`:
   - `-R owner/repo` or `--repo owner/repo`;
   - a GitHub URL given as an argument (`https://github.com/owner/repo/pull/1`);
   - `GH_REPO=owner/repo` set on the command or in Claude Code's environment;
   - `gh repo create owner/name`, `--org` on `gh secret`, `gh variable` and `gh repo fork`;
   - the `repos/OWNER`, `orgs/OWNER` and `users/OWNER` endpoint of `gh api`.

   A URL that ends up as a flag's value is compared with the repo the command runs in, and if they differ the mod asks.
2. Otherwise, the repo the command runs in:
   - for `gh`, `git remote get-url origin`;
   - for `git push <remote>`, every push URL of that remote (`remote get-url --push --all`);
   - for a bare `git push`, the remote git itself would push to (`@{push}`: the branch's `pushRemote`, then `remote.pushDefault`, then the upstream).

   A `cd dir &&` earlier in the command, `git -C dir`, `--git-dir` and `GIT_DIR=` are followed.

An SSH host whose name starts with `github` (`git@github-work:owner/repo`, the usual alias for a second key) counts as GitHub.

**Which account the call will use.** In this order:

1. A token: `GH_TOKEN` or `GITHUB_TOKEN`, from Claude Code's environment, set before the command word, or exported earlier in the command. An empty value, `env -u` and `unset` take it away. The call runs if the owner is in your `tokenOwners` list.
2. For `git push` only: a clone that resets the credential helpers and brings its own. The repo's local config (or a `-c` on the command) must have an empty `credential.helper` entry followed by a helper; then that helper picks the account, not `gh`, and the mod stands down. A helper added without the reset doesn't count, because git tries the global `gh auth git-credential` first. Helper settings it can't read make it ask.
3. An earlier `gh auth switch --user X` in the same command: later parts are judged as X, but only when they surely run after it (joined by `;` or `&&`). After `||`, `|` or `&`, after a switch that may itself be skipped (`false && gh auth switch …; git push`), or after `gh auth login`/`logout`, the account is unknown and the mod asks.
4. The active account in the `gh` keyring, read with `gh config get -h github.com user` each time a command is checked. That reads the local `gh` config, with no network call. It's the value `gh auth switch` rewrites, so a switch made in another terminal is seen at once.

A `git push` to an SSH remote isn't checked: it uses your SSH key, not the `gh` account.

The patterns it demonstrates:

- Asking the person from inside a `tool.call` hook with `$.ui.ask`, the engine's own question dialog. Time spent waiting there doesn't count against the hook's budget, and the call rejects when there is nobody to ask.
- A guard registered with `.catch`, so an error inside it refuses the call instead of letting it through.
- Plugin options from `userConfig`.

## What this is not

A seat belt against accidents, not a security boundary. The risk it covers is Claude running an ordinary `gh` or `git push` command while a stale account is active. It does not try to stop a command written to get past it. A text reader can't follow every shell trick: quoting a command word apart (`g'h' pr merge`), shell functions and aliases, scripts and sourced files, variables used as commands, and heredoc bodies. For a hard block, use [permission rules](https://code.claude.com/docs/en/settings).

## Demo

No screenshot yet. The question reads like this (made-up names):

> The repo owner some-org needs the GitHub account work-user, but this call would run as my-user. Run `git push origin main`?
>
> 1. Switch to work-user and run
> 2. Run anyway
> 3. Cancel

## How it was built

- **Model:** built with Claude in Claude Code (Claude Opus 5.5). The mod itself doesn't call a model.
- **Prompt(s):** a brief from a lead agent: hold any `gh …` or `git push …` call, work out which account the target repo needs, compare it with the account the call will use, and on a mismatch offer Switch, Run anyway and Cancel; never slow down ordinary shell calls.
- **Transcript:** not shared.
- **Iterations:**
  - **Reading the active account.** The first version used `gh auth status` and cached the answer, because that command checks each token over the network (about half a second). A cache goes stale when another session switches the global account, which is exactly the case this mod is for. `gh config get -h github.com user` reads the same answer from the local config in about a tenth of a second, so it's read on every checked command and there's no cache.
  - **Asking.** The first version drew its own pane and held the call with a sleep loop, as the Blast Radius sample does. That needed a 144-column terminal, a fallback for narrow ones, a switch for headless sessions, and care when the pane was closed by hand. The engine's question dialog (`$.ui.ask`) does all of that, so the pane is gone.
  - **First review (Claude).** An independent review found the first version let calls through when it couldn't tell:
    - a failed remote lookup;
    - a `gh auth` word anywhere in the text;
    - only the first target judged;
    - URLs in flag values;
    - `gh api` flags before the path;
    - a credential helper that git adds to the global one rather than replacing it.

    Each of these now asks.
  - **Second review (GPT-6 Astra).** A cross-model review found more of the same kind:
    - ownerless writes such as `gh repo create`;
    - a Switch that would make an earlier part of the command wrong;
    - empty remote output read as "not GitHub";
    - a bare `git push` assumed to go to `origin`;
    - `-c remote.*` overrides;
    - `GH_REPO` and `GH_HOST`;
    - a nested `bash -c` beside a readable target;
    - a quoted `gh auth switch` read as a real one;
    - a slow pattern on long commands.

    The command is now read in one pass that respects quotes, and each finding has a test. The review also argued that no text reader can be safe against a command built to evade it. That is true, and out of scope (see What this is not).
  - **Tests.** Run with `claude plugin test` against stand-ins for git, `gh` and the question dialog (50 tests). Not yet tried in a live session.

## Run it

**Requirements:**

- Claude Code 2.1.295 or later (the build it was written and tested on).
- `gh` and `git` on your `PATH`.

**Steps:**

1. Install it, at the prompt of a Claude Code terminal session:

   ```
   /plugin install gh-account-guard --marketplace jsnkle/ai-native-sdlc
   ```

   Answer `y` to add the marketplace, then pick a scope (user scope first). The install screen asks for the options below.

2. Set the rules. Either through `/config`, or by hand in `~/.claude/settings.json` (plugin options aren't read from a project's `.claude/settings.json`):

   ```json
   {
     "pluginConfigs": {
       "gh-account-guard@jsnkle": {
         "options": {
           "rules": "my-user=my-user,my-side-org; work-user=Work-Org",
           "tokenOwners": "my-side-org"
         }
       }
     }
   }
   ```

   For a copy loaded with `claude --plugin-dir`, the key is `gh-account-guard` instead.

3. Ask Claude to do something with `gh` or `git push` in a repo whose owner needs a different account from the active one.

**Options:**

| Option | What it holds | Default |
| --- | --- | --- |
| `rules` | Which account each repo owner needs: `account=owner,owner; account=owner`. Rules are separated by `;` or a new line, owners by commas. Owners are GitHub users or orgs and are matched without regard to case. Your own user name is an owner too: list it if its repos should run as that account. If an owner is listed twice, the first rule wins. | empty |
| `tokenOwners` | Owners that a `GH_TOKEN` or `GITHUB_TOKEN` may reach, comma-separated. A token call to any other owner is held. | empty |

## Notes / limitations

- See What this is not: it reads the command text, and it guards against accidents.
- When several parts of a command have problems, the question describes the first and counts the rest.
- `gh` flags are told apart from their values by a short list of flags that take none. An unlisted one takes the next word as its value. A URL taken that way is still compared with the repo the command runs in.
- Only `github.com` (and SSH hosts named `github…`) is checked. Other hosts pass through, and `--hostname` or `GH_HOST` for another host makes it ask.
- Each checked command runs `git` up to four times and `gh config get` once, which adds a fraction of a second. Shell commands without `gh` or `git` cost nothing.
- Switch changes the active `gh` account for every session and every repo, as `gh auth switch` always does.

## Dependencies

| Name | Version | License (SPDX) | Source |
| --- | --- | --- | --- |
| None | | | |

The mod has no packages to install. It calls `gh` and `git`, which are already on the machine.

## Third-party notices

GitHub is a trademark of GitHub, Inc. Git is a trademark of Software Freedom Conservancy. OpenAI and GPT are trademarks of OpenAI. Use of these names here is descriptive and implies no endorsement.

---

Shared as-is. No support or maintenance is implied. See the repository's LICENSE.
