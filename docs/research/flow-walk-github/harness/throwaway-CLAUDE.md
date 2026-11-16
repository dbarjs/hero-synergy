# tally

A tiny command-line tool that reports counts about a text file. Plain Node.js (22+), no dependencies.

- Run the tests with `npm test` (Node's built-in test runner).
- Source lives in `src/`, tests in `test/`.

## Building a ticket

This repo closes work through pull requests. A build session assigns the ticket to itself before any work, commits on its own branch, pushes that branch and opens a pull request to `main` whose description says `Closes #<number>`, so the merge closes the ticket.

## Agent skills

### Issue tracker

Issues live in GitHub Issues on `dbarjs/flow-walk-throwaway`, managed with the `gh` CLI. See `docs/agents/issue-tracker.md`.

### Triage labels

The five default triage labels: `needs-triage`, `needs-info`, `ready-for-agent`, `ready-for-human`, `wontfix`. See `docs/agents/triage-labels.md`.

### Domain docs

Single-context: one `GLOSSARY.md` and `docs/adr/` at the repo root. See `docs/agents/domain.md`.
