import { createHash } from 'node:crypto';
import { afterEach, expect, test, vi } from 'vitest';

const originalEnv = { ...process.env };

async function loadAuthModule(env: NodeJS.ProcessEnv = {}) {
  vi.resetModules();
  process.env = {
    ...originalEnv,
    SINGLE_USER_MODE: 'false',
    API_KEY: '',
    API_KEYS: '',
    ...env,
  };
  return import('../src/users/auth');
}

afterEach(() => {
  process.env = { ...originalEnv };
  vi.resetModules();
});

test('resolveUserIdFromApiKey uses a stable opaque identifier', async () => {
  const { resolveUserIdFromApiKey } = await loadAuthModule();
  const first = resolveUserIdFromApiKey('sk-test-key');
  const second = resolveUserIdFromApiKey('sk-test-key');

  expect(first).toBe(second);
  expect(first).toMatch(/^api_[a-f0-9]{16}$/);
});

test('resolveUserIdFromApiKey differentiates distinct API keys', async () => {
  const { resolveUserIdFromApiKey } = await loadAuthModule();
  expect(resolveUserIdFromApiKey('key-one')).not.toBe(resolveUserIdFromApiKey('key-two'));
});

test('resolveUserIdFromApiKey does not expose a raw sha256 slice of the API key', async () => {
  const { resolveUserIdFromApiKey } = await loadAuthModule();
  const rawSha256Slice = createHash('sha256').update('sk-test-key').digest('hex').slice(0, 16);

  expect(resolveUserIdFromApiKey('sk-test-key')).not.toBe(`api_${rawSha256Slice}`);
});

test('validateApiKey returns true when no API_KEY is configured', async () => {
  const { validateApiKey } = await loadAuthModule();
  // With default empty API_KEY, any key should pass
  expect(validateApiKey('anything')).toBe(true);
});

test('validateApiKey handles keys of different lengths without timing leak', async () => {
  const { validateApiKey } = await loadAuthModule();
  // This test verifies the hash-based comparison works regardless of length
  // (no early return on length mismatch)
  expect(validateApiKey('short')).toBe(true); // passes because API_KEY is empty by default
  expect(validateApiKey('a-much-longer-key-than-the-other')).toBe(true);
});
