# The Cockpit launches and watches; it never writes to the tracker or runs git

The Cockpit's only write is spawning a `claude` process with the right flags and environment. It does not create, merge or remove worktrees, does not push or commit, and does not change issues. Everything that lands in the repo or on the tracker is done by the session, following the skills and the repo's own agent docs; the Cockpit reads the result and shows it.

The question that forced the decision, on 2026-10-02, was how a session's glossary and ADR edits get from its `claude -w` worktree back to `main`. The Cockpit could have done it (a merge-back action, a "remove worktree" button). It doesn't, because:

- **Safe to leave open.** A view that only reads can run in every window, all day, beside sessions it didn't launch, and nothing it does can lose work. The first git command it runs ends that.
- **One owner per write.** Sessions already decide what to commit and where, by skill convention. A second writer in the Cockpit would have to agree with every skill version and every repo's `CLAUDE.md`, and it couldn't.
- **The tracker half was already decided.** Writing to the tracker from the Cockpit is out of scope for v0.1.0; this extends the same boundary to git, so the rule is one sentence rather than two exceptions.

What the Cockpit does instead: it launches ticket sessions with `-w <slug>` on a GitHub tracker (without `-w` on a local tracker, whose gitignored `.scratch` would otherwise be invisible in the worktree), and it shows each ticket's worktree with whether it has uncommitted files or commits not on `main`. Removal is claude's own exit prompt or the developer's hand.

## Considered options

- **The Cockpit runs git: creates the worktree, merges or pushes the branch back at ticket close, removes it.** Rejected: it makes the Cockpit a second writer that has to track skill conventions, and a bug in it can delete a session's unpushed work.
- **The Cockpit writes the convention into the user's repo** (`CLAUDE.md` or `docs/agents/issue-tracker.md`) so sessions follow one rule. Rejected for v0.1.0: that is the Cockpit writing to the repo by another route. The convention is documented in hero-synergy's README as a recommendation instead.

## Consequences

- The push-back routine is a convention the session follows, not a feature: commit on the worktree branch, `pnpm install` there if a check needs it, rebase onto `origin/main`, push `HEAD:main` when the ticket closes. Two sessions editing `CONTEXT.md` at once resolve the conflict in the session that pushes second.
- A "remove worktree" or "merge back" button is a change to this decision, not a small feature.
- The Cockpit may show state it cannot fix: a worktree with unpushed commits stays listed until the developer deals with it.
