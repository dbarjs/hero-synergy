# Process recordings

One file per command line the Cockpit runs, recorded from a real run and served by `ProcessRunner.replay` in tests. Each file is a `ProcessRecording`: the `command`, its `args`, the `stdout` and `stderr` it produced and its `exitCode` (`null` with `timedOut: true` when the run was killed). The stub `gh` of the extension-host tests reads the same files.

Record a new one by running the command through `ProcessRunner.live` and writing `toRecording(request, result)` as JSON. Name the file after the command line, hyphenated: `gh-version.json`, `claude-agents-json.json`.

Recorded here on 2026-10-07: `gh` 2.100.0 and Claude Code 2.1.292.
