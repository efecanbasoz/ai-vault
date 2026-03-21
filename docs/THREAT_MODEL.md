# Threat Model

## Assets

- API keys and bot tokens
- Vault note content
- User identity mappings and session state

## Trust Boundaries

- Telegram users -> bot interface
- HTTP clients -> API interface
- App process -> local filesystem vault
- App process -> external LLM APIs/CLI tools

## Key Threats

- Unauthorized API/Telegram access
- Path traversal to read/write files outside vault
- Symlink redirection attacks on vault directories
- gray-matter JavaScript frontmatter engine enabling eval()-based RCE
- Prompt injection via malicious note titles in system prompt
- Unbounded session/message history memory growth (DoS)
- Secret leakage through logs (session IDs, error bodies)
- Supply-chain risk from dependencies (gray-matter eval engine)
- Shared API identity collapsing all users into one vault (design limitation)

## Existing Controls

- API key and Telegram allowlist checks
- Path normalization and category path constraints
- Symlink rejection in vault file operations (added 2026-03-21)
- gray-matter JavaScript engine disabled (added 2026-03-21)
- VaultCategory Zod validation in all interfaces (added 2026-03-21)
- System prompt title sanitization (added 2026-03-21)
- Session eviction and message history trimming (added 2026-03-21)
- CORS middleware with configurable origin (added 2026-03-21)
- userId format validation before filesystem path construction (added 2026-03-21)
- Log redaction for session IDs and provider error bodies (added 2026-03-21)
- Request body and rate-limit middleware
- Typed config validation via `zod`
- CI + audit + secret scanning

## Known Limitations

- Single global API_KEY: all API callers share one userId and vault (SEC-001). This is by design for v1 single-tenant deployments. Multi-key auth requires a feature-level change.
- Search index rebuilt on every query (no caching). Acceptable for small vaults, may need optimization for large deployments.

## Next Hardening Steps

- Add integration tests for auth and vault path safety
- Add per-user quotas for costly provider operations
- Add optional persistent rate-limit backend for multi-instance deploys
- Implement per-key API authentication for multi-tenant support
- Add search index caching with invalidation on vault writes
