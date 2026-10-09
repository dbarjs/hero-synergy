---
'hero-synergy': patch
---

Stop warning that Claude Code listed a session this version cannot read when a background session has a `state` and no `status`. The session is kept in the registry with status unknown, and nothing is flagged.
