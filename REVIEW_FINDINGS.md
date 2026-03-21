# Security & Code Quality Review Findings

**Date**: 2026-03-21
**Reviewers**: Codex CLI (GPT-5.4, read-only sandbox) + Claude Opus 4.6 manual analysis
**Scope**: Full codebase (`src/`, 46 files, ~3,248 LOC)

---

## Summary

| Severity | Count | Fixed |
|----------|-------|-------|
| HIGH | 3 | 3 |
| MEDIUM | 5 | 5 |
| LOW | 4 | 4 |
| INFO | 2 | 0 |
| Quality (from Codex scan) | 3 | 3 |
| **Total** | **17** | **15** |

---

## HIGH Severity

### SEC-001: Shared API Identity Collapses All Users
- **Source**: Codex CLI
- **Files**: `src/users/auth.ts:10`, `src/interfaces/api/middleware.ts:79`
- **Description**: Single global `API_KEY` maps all API callers to the same `userId`. Anonymous mode collapses to `api_anonymous`. All vault data, sessions, and provider state are shared.
- **Impact**: Any API client can read/overwrite/delete another client's notes and sessions.
- **Fix**: Document as known limitation for v1 (single-tenant design). Add warning to `.env.example` and README. Multi-key auth is a feature-level change beyond this review.
- **Phase**: 5d (Documentation)

### SEC-002: gray-matter JS Frontmatter Enables RCE
- **Source**: Codex CLI
- **Files**: `src/vault/manager.ts:74`, `src/vault/manager.ts:107`, `src/vault/manager.ts:152`
- **Description**: `gray-matter` default settings include a `javascript` frontmatter engine that uses `eval()`. A crafted `.md` file with `---javascript` frontmatter executes arbitrary code on the server.
- **Impact**: Remote code execution if attacker can place or import a crafted `.md` file into the vault.
- **Fix**: Disable JS/TOML/coffee engines, allow only YAML.
- **Phase**: 5a (Critical)

### SEC-003: Unvalidated VaultCategory in Telegram & CLI
- **Source**: Codex CLI + Manual
- **Files**: `src/interfaces/telegram/commands.ts:104,118,157,162`, `src/interfaces/cli/repl.ts:83,100`
- **Description**: User input cast to `VaultCategory` via `as` without Zod validation. API handlers (`handlers.ts:12`) properly validate with `categorySchema`, but Telegram and CLI bypass this.
- **Impact**: Path traversal via `listNotes()` — directory enumeration beyond vault root. Invalid categories passed to `saveFromChat()`.
- **Fix**: Reuse existing `categorySchema` from handlers.ts in both Telegram commands and CLI REPL.
- **Phase**: 5a (Critical)

---

## MEDIUM Severity

### SEC-004: Symlink Attack on Vault Paths
- **Source**: Codex CLI
- **Files**: `src/vault/manager.ts:24,139`, `src/users/store.ts:8`
- **Description**: `resolveSafeVaultPath()` is lexical only — no `realpath()` or symlink rejection. Symlinks under vault directories can redirect reads/writes/deletes outside the intended root.
- **Impact**: File read/write/delete outside vault if attacker can place symlinks.
- **Fix**: Add `realpath()` check and symlink rejection in `resolveSafeVaultPath()`.
- **Phase**: 5b (Hardening)

### SEC-005: Prompt Injection via Note Titles
- **Source**: Codex CLI
- **Files**: `src/vault/system-prompt.ts:31`
- **Description**: Note titles and filepaths interpolated directly into LLM system prompt without sanitization. Titles can contain newlines or instruction-like text.
- **Impact**: Persistent prompt poisoning affecting model behavior for the user's sessions.
- **Fix**: Sanitize titles (strip control chars, truncate) and delimit as untrusted data in system prompt.
- **Phase**: 5b (Hardening)

### SEC-006: Unbounded Session Memory Growth
- **Source**: Codex CLI + Manual
- **Files**: `src/core/session.ts:13`, `src/core/engine.ts:58`
- **Description**: In-memory `sessions` map has no eviction policy. `messageHistory` grows without byte-size limits. API messages can be 100k chars.
- **Impact**: Memory exhaustion DoS under sustained use or with many distinct users.
- **Fix**: Add `MAX_HISTORY_ITEMS` constant and trim oldest messages when exceeded.
- **Phase**: 5b (Hardening)

### SEC-007: Missing CORS Configuration
- **Source**: Manual
- **Files**: `src/interfaces/api/server.ts:13`
- **Description**: No CORS middleware on Hono app. `secureHeaders()` is applied on API routes but CORS is separate.
- **Impact**: Browser-based API clients will be blocked. No origin restriction if CORS headers are added naively.
- **Fix**: Add `hono/cors` middleware with configurable `API_CORS_ORIGIN` env var.
- **Phase**: 5b (Hardening)

### SEC-008: userId in Filesystem Paths Without Sanitization
- **Source**: Manual
- **Files**: `src/users/store.ts:8-9`
- **Description**: `userId` embedded directly in filesystem path via `path.resolve(config.DATA_PATH, 'users', userId)`. While userId is internally generated (e.g., `telegram_123`, `api_<hash>`), the format is not enforced at the filesystem boundary.
- **Impact**: Low risk since userId generation is controlled, but defense-in-depth requires validation.
- **Fix**: Add regex allowlist validation for userId format before path construction.
- **Phase**: 5b (Hardening)

---

## LOW Severity

### SEC-009: Search Rebuilds Index Every Call
- **Source**: Codex CLI (SEC-007)
- **Files**: `src/vault/search.ts:67`, `src/vault/manager.ts:183`
- **Description**: Every search call reads all notes, parses frontmatter, and rebuilds TF-IDF index. No caching.
- **Impact**: CPU/disk amplification on large vaults. Repeated searches degrade service.
- **Fix**: Add simple cache with invalidation on vault write operations.
- **Phase**: 5c (Quality)

### SEC-010: Session IDs and Error Bodies in Logs
- **Source**: Codex CLI (SEC-008)
- **Files**: `src/providers/claude-cli.ts:56,77`, `src/providers/openai-api.ts:42`
- **Description**: Debug logs include full Claude `sessionId` and raw upstream error bodies (truncated to 500 chars).
- **Impact**: Log readers can resume Claude sessions or view sensitive prompt/account details.
- **Fix**: Redact session IDs and limit error body logging.
- **Phase**: 5c (Quality)

### QA-001: Silent Catch Blocks
- **Source**: Manual
- **Files**: `src/interfaces/telegram/commands.ts:120,149,174,186`, `src/interfaces/cli/repl.ts:75,92,113`
- **Description**: Multiple catch blocks swallow errors without logging. Makes debugging production issues impossible.
- **Fix**: Add `logger.warn()` in catch blocks with error context.
- **Phase**: 5c (Quality)

### QA-002: Hardcoded Version String
- **Source**: Manual + Codex partial
- **Files**: `src/interfaces/api/server.ts:16`
- **Description**: Health endpoint returns `version: '1.5.0'` hardcoded instead of reading from package.json.
- **Fix**: Import version from package.json or use a build-time constant.
- **Phase**: 5c (Quality)

---

## INFO (No Action Required)

### INFO-001: No Shell-Based Command Injection
- **Source**: Codex CLI
- **Description**: All CLI providers use `spawn()` with argv arrays and no shell. Prompts are not interpreted by a shell. No finding.

### INFO-002: No SSRF Sink
- **Source**: Codex CLI
- **Description**: Outbound `fetch()` targets are hardcoded provider URLs. No user-controlled URL construction found.

---

## Dependency Audit

| Package | Version | Status |
|---------|---------|--------|
| hono | 4.12.8 | Above fixed ranges for CVE-2025-62610, CVE-2026-29045 |
| zod | 3.25.76 | Above fixed range for CVE-2023-4316 |
| grammy | 1.41.1 | No known advisory |
| gray-matter | 4.0.3 | JS engine eval risk (addressed in SEC-002) |
| node-cron | 3.0.3 | No known advisory |
| pino | 9.14.0 | No known advisory |

---

## Fix Phases

### Phase 5a: Critical Security Fixes
- SEC-002: Disable gray-matter JS frontmatter engine
- SEC-003: Validate VaultCategory with Zod in Telegram commands + CLI REPL

### Phase 5b: Security Hardening
- SEC-004: Add realpath + symlink rejection in vault path resolution
- SEC-005: Sanitize note titles in system prompt
- SEC-006: Add message history size limit
- SEC-007: Add CORS middleware
- SEC-008: Add userId format validation

### Phase 5c: Code Quality
- SEC-009: Cache search index (scope: future improvement, document only)
- SEC-010: Redact sensitive data in logs
- QA-001: Add logging to silent catch blocks
- QA-002: Dynamic version from package.json

### Phase 5e: Additional Quality (from Codex quality scan)
- QA-007: Validate frontmatter fields before writing (no blind `as NoteMetadata` cast)
- QA-008: Add logging to silent catch blocks in index.ts and registry.ts
- QA-009: Add global `app.onError` boundary for consistent JSON error responses

### Phase 5d: Documentation
- SEC-001: Document shared identity limitation
- Update THREAT_MODEL.md and SECURITY_CHECKLIST.md
