# Retrospective: one process for two tools, 2026-09-05 to 25

On 2026-09-05 two agents tried to turn this kit's process into one that both Claude Code and OpenAI Codex could implement:

- **Fable**: Claude, running in Claude Code.
- **Astra**: GPT-6, running in Codex.

They produced three things: a vendor-neutral rewrite of the playbook, a proposed shared contract (0.3) for the records a change produces, and a validation round with four authors and twenty blind reviewers. On 2026-09-25 we tested how much of this kit Codex can use, and chose two kits with shared principles over one kit for both.

Nothing from the effort was merged. The kit is unchanged apart from the documentation corrections that came with this retrospective. The full record is kept privately, because it includes a copy of a third-party page, and the Codex kit starts in its own repository.

## What happened

- **Round one: readers agreed, but only the first step was tested.**
  - 18 of 20 author classifications matched the most common answer.
  - 18 of 20 blind reviewers reached the same result as the author they checked.
  - Readers on both tools stopped at the same missing prerequisite.
  - No change got past `open`, because no test request came from a verifiable source. Enforcement and time saved were not tested.
  - The largest gap was the lack of a rule for when a follow-up request amends a change and when it starts a new one.
- **Portability to Codex: partial.**
  - Codex installed this plugin from `.claude-plugin/` with no changes, and loaded all six skills.
  - The agents, permissions and CI workflows do not carry over.
  - Codex's `/import` converted the template's `CLAUDE.md` with a blind "Claude"→"Codex" text replacement, which broke the `.claude/` paths. It wrote the hook commands as absolute paths on the importing machine. It skipped the permissions, the plugin settings, `REVIEW.md` and the workflows without a word.
- **Decision.** The practical layers differ enough that one kit would become one tool's kit with exceptions for the other. The shared contract is shelved, and its 20 to 40 minutes of hand work per change is not justified by what round one showed.

## Lessons for this kit (observed)

1. **A hook that cannot read its input allows the action, silently. This has now happened twice.**
   - First, `< /dev/stdin` read nothing on a Linux runner (0.2.0).
   - Now, Codex hands file edits to hooks as a patch, so `protect-tests.sh` and `no-secrets.sh` find no path or content and exit 0. `protect-tests.sh` allowed a test rewritten to `assert True`.
   - The kit is Claude Code only, and the plugin README now says so. The hooks play no longer claims a hook makes a policy "impossible to skip".
2. **"Never approves or merges" is a prompt, not a control.**
   - All four authors who read the review and mention workflows noticed it independently: the review step's allowed tools include `gh api *`, which reaches the review endpoint, and the fix loop allows `git *`.
   - It holds only when branch protection requires a code-owner review and no token the agent uses belongs to a code owner. `LOOP_GH_TOKEN` acts as whoever created it.
   - The docs, `CODEOWNERS` and the workflow comments now state these conditions. The template README says to create the token from an account that is not a code owner.
3. **The workflows need files the template does not ship.**
   - Four workflows install `requirements-dev.txt`, and the build triage and the agent's allowed commands assume `make` targets.
   - Both fresh readers found this on first contact. The two authors who knew the kit did not.
   - The template README now lists both files.
4. **Claude Code reads `AGENTS.md` only when there is no `CLAUDE.md`.** Adopting the kit in a repo that already has `AGENTS.md` would hide that file from Claude unless `CLAUDE.md` imports it with `@AGENTS.md`. The CLAUDE.md play now says so.
5. **Evidence for the tiering proposal from the 2026-09-03 retrospective, which is still not adopted:**
   - Readers split three to one on whether a change that only tightens an authorization boundary is a trigger. "Anything touching auth" has the same gap.
   - Removing the tier label from the packets was not enough. A term scan came back clean, yet authors still named the path in other words.
   - Working the path out blind caught both author outliers. That supports the proposal's review pass that works the tier out again.

## How the work was done (observed)

- **The evidence had one copy, on one laptop.** 37 branches were never pushed. The findings cited commits that nobody else could resolve. Push or bundle evidence each time a result is sealed.
- **Tooling kept in a temporary folder was lost.** Thirteen orchestration scripts lived outside every repository copy and were cleared with the folder. The results survived; the means of reproducing them did not. Commit tooling with its results.
- **A third-party page was committed verbatim.** It was fine for reference, but it made the branch unsafe to merge into this public repository. Link to such pages instead.
- **One prompt defect reached every run that used it.** The prompt shared by all ten Claude-side reviewers prescribed a reference form the contract does not allow, so every one of those reviews inherited it. Dry-run a prompt or instruction once before fanning it out.
- **Running the tools found what reading missed.**
  - The link checker passed a broken link.
  - The resolver committed unrelated staged work.
  - Both were found by running them in a scratch clone.
- **Claims outran checks.** "Zero mechanical issues" was reported before references were resolved, and one attribution was stated backwards. Say what each check covered.
- **Authority relayed by another agent was refused.** Astra would not start validation agents on Fable's report that the owner had approved, and waited for the owner. Keep that rule.

## Ready, not adopted

In order of value. Each item waits for a real case or an owner decision.

1. **Hooks fail closed.** Block with a message when `jq` is missing or no path can be read. Handle `NotebookEdit`'s `notebook_path`. Note that a machine without `jq` would then block every edit.
2. **The smoke test in `agent-evals.yml` asserts its exit codes.** Today it only prints them and cannot fail. An adopter who edits the default protected paths would need to change the test too.
3. **Narrow the agent's tools.** Name the `gh api` endpoints it may call instead of allowing `gh api *`, and allow `git push` without force.
4. **Evals fail on an errored or empty run,** with one case that must fail.
5. **Loop guards for `claude-mention.yml`:**
   - a per-PR `concurrency` group
   - the workflow, not the model, adds the `[claude-mention]` prefix
   - a cap on runs per PR
6. **Stale specs.** `spec.md` records the intent commit it was written from, and a changed intent is flagged. Today `spec-on-intent-merge.yml` skips any intent that already has a spec.
7. **"A skipped check is a recorded gap, not a pass,"** in the template `CLAUDE.md` and the verifier agent.
8. **`adopt` writes `@AGENTS.md` into the new `CLAUDE.md`** when the repo already has an `AGENTS.md`.
9. **Eval coverage for the review and fix-loop prompts.** They sit inline in `claude-review.yml` and `claude-mention.yml`, outside the paths `agent-evals.yml` watches.
10. **An Observation line in the spec and plan templates:** how and when to check whether the change helped.
11. **Plan departures recorded under a `## Departures` heading,** leaving the approved steps as they were. This is low priority, because the 2026-09-03 retrospective saw departures recorded properly.
