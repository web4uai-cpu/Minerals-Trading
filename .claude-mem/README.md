# .claude-mem — Claude's Project Memory

This directory is Claude Code's persistent, in-project memory for the Khanij Nexus
codebase. Claude reads and updates these files across conversations to maintain
continuity without re-deriving context from scratch every time.

## How it works

- Claude reads relevant files at the start of a conversation when context is needed
- Claude appends entries (never overwrites) when making significant decisions
- Files are plain Markdown — human-readable and reviewable in PRs
- The files complement the user-level memory at `~/.claude/projects/.../memory/`
  (that stores user preferences; this stores project state)

## Files

| File | Contents |
|------|----------|
| [CONTEXT.md](CONTEXT.md) | One-page project snapshot — read first |
| [DECISIONS.md](DECISIONS.md) | Significant choices made during development |
| [PROGRESS.md](PROGRESS.md) | Module completion status, what's next |
| [OPEN_QUESTIONS.md](OPEN_QUESTIONS.md) | Unresolved design questions |
| [PATTERNS.md](PATTERNS.md) | Code patterns established and validated |

## Rules

- Claude appends to these files; humans can edit or correct entries
- Entries are dated (YYYY-MM-DD)
- No secrets, no PII, no API keys ever stored here
- Committed to git — history is the undo mechanism
