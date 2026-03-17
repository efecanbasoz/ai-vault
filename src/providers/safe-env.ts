const DEFAULT_SAFE_ENV_KEYS = ['PATH', 'HOME', 'USER', 'SHELL', 'TERM', 'NODE_ENV', 'LANG', 'TMPDIR', 'TMP', 'TEMP'];

export interface SafeEnvOptions {
  exactKeys?: string[];
  prefixKeys?: string[];
}

export function createSafeCliEnv(
  options: SafeEnvOptions = {},
  env: NodeJS.ProcessEnv = process.env,
): Record<string, string | undefined> {
  const safeEnv: Record<string, string | undefined> = {};

  for (const key of DEFAULT_SAFE_ENV_KEYS) {
    safeEnv[key] = env[key];
  }

  for (const key of Object.keys(env)) {
    if (options.exactKeys?.includes(key) || options.prefixKeys?.some((prefix) => key.startsWith(prefix))) {
      safeEnv[key] = env[key];
    }
  }

  return safeEnv;
}
