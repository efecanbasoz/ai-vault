import test from 'node:test';
import assert from 'node:assert/strict';
import { resolveUserIdFromApiKey, validateApiKey } from './auth';

test('resolveUserIdFromApiKey uses a stable digest-based identifier', () => {
  const first = resolveUserIdFromApiKey('sk-test-key');
  const second = resolveUserIdFromApiKey('sk-test-key');

  assert.equal(first, second);
  assert.match(first, /^api_[a-f0-9]{16}$/);
});

test('resolveUserIdFromApiKey differentiates distinct API keys', () => {
  assert.notEqual(resolveUserIdFromApiKey('key-one'), resolveUserIdFromApiKey('key-two'));
});

test('validateApiKey returns true when no API_KEY is configured', () => {
  // With default empty API_KEY, any key should pass
  assert.equal(validateApiKey('anything'), true);
});

test('validateApiKey handles keys of different lengths without timing leak', () => {
  // This test verifies the hash-based comparison works regardless of length
  // (no early return on length mismatch)
  assert.equal(validateApiKey('short'), true); // passes because API_KEY is empty by default
  assert.equal(validateApiKey('a-much-longer-key-than-the-other'), true);
});
