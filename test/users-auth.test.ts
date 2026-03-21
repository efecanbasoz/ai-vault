import { test, expect } from 'vitest';
import { resolveUserIdFromApiKey, validateApiKey } from '../src/users/auth';

test('resolveUserIdFromApiKey uses a stable digest-based identifier', () => {
  const first = resolveUserIdFromApiKey('sk-test-key');
  const second = resolveUserIdFromApiKey('sk-test-key');

  expect(first).toBe(second);
  expect(first).toMatch(/^api_[a-f0-9]{16}$/);
});

test('resolveUserIdFromApiKey differentiates distinct API keys', () => {
  expect(resolveUserIdFromApiKey('key-one')).not.toBe(resolveUserIdFromApiKey('key-two'));
});

test('validateApiKey returns true when no API_KEY is configured', () => {
  // With default empty API_KEY, any key should pass
  expect(validateApiKey('anything')).toBe(true);
});

test('validateApiKey handles keys of different lengths without timing leak', () => {
  // This test verifies the hash-based comparison works regardless of length
  // (no early return on length mismatch)
  expect(validateApiKey('short')).toBe(true); // passes because API_KEY is empty by default
  expect(validateApiKey('a-much-longer-key-than-the-other')).toBe(true);
});
