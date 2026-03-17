import test from 'node:test';
import assert from 'node:assert/strict';
import { createSafeCliEnv } from './safe-env';

test('createSafeCliEnv keeps standard process context while dropping unrelated secrets', () => {
  const safeEnv = createSafeCliEnv(
    {
      exactKeys: ['OPENAI_API_KEY'],
      prefixKeys: ['CODEX_'],
    },
    {
      PATH: '/usr/bin',
      HOME: '/home/tester',
      OPENAI_API_KEY: 'sk-live',
      CODEX_PROFILE: 'default',
      DATABASE_URL: 'postgres://secret',
    },
  );

  assert.equal(safeEnv.PATH, '/usr/bin');
  assert.equal(safeEnv.OPENAI_API_KEY, 'sk-live');
  assert.equal(safeEnv.CODEX_PROFILE, 'default');
  assert.equal('DATABASE_URL' in safeEnv, false);
});
