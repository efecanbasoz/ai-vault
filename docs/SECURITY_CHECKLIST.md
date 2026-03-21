# Security Checklist

## Pre-Release

- [ ] `npm audit --omit=dev` is clean or reviewed.
- [ ] CI pipeline (`typecheck`, `build`, `audit`) is green.
- [ ] Secret scan is green.
- [ ] `.env.example` reflects current required security vars.

## Runtime

- [ ] `API_KEY` is set in production (or anonymous mode is explicitly approved).
- [ ] `TELEGRAM_ALLOWED_USERS` is configured (or public mode explicitly approved).
- [ ] `CLAUDE_SKIP_PERMISSIONS` remains `false` unless controlled environment.
- [ ] `API_CORS_ORIGIN` is set to restrict origins (defaults to `*` if unset).
- [ ] Logs are retained without exposing secrets (session IDs and error bodies are redacted).

## Storage and Access

- [ ] Vault path points to dedicated directory with no symlinks.
- [ ] No symbolic links exist under vault or user data directories.
- [ ] Backups are encrypted and access-controlled.
- [ ] Deploy target runs as non-root user.

## Code Security (added 2026-03-21)

- [ ] gray-matter JavaScript frontmatter engine is disabled (safeMatter wrapper).
- [ ] VaultCategory validated with Zod in all interfaces (API, Telegram, CLI).
- [ ] Session memory bounded (MAX_SESSIONS=1000, MAX_HISTORY_ITEMS=50).
- [ ] Note titles sanitized before system prompt interpolation.
- [ ] userId format validated before filesystem path construction.
