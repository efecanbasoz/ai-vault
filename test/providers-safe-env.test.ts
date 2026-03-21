import { test, expect } from 'vitest';
import { createSafeCliEnv } from '../src/providers/safe-env';

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

  expect(safeEnv.PATH).toBe('/usr/bin');
  expect(safeEnv.OPENAI_API_KEY).toBe('sk-live');
  expect(safeEnv.CODEX_PROFILE).toBe('default');
  expect('DATABASE_URL' in safeEnv).toBe(false);
});
