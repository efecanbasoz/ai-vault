import test from 'node:test';
import assert from 'node:assert/strict';
import { resolveUserIdFromApiKey } from './auth';

test('resolveUserIdFromApiKey uses a stable digest-based identifier', () => {
  const first = resolveUserIdFromApiKey('sk-test-key');
  const second = resolveUserIdFromApiKey('sk-test-key');

  assert.equal(first, second);
  assert.match(first, /^api_[a-f0-9]{16}$/);
});

test('resolveUserIdFromApiKey differentiates distinct API keys', () => {
  assert.notEqual(resolveUserIdFromApiKey('key-one'), resolveUserIdFromApiKey('key-two'));
});
