import { config } from '../config.js';
import { logger } from '../logger.js';
import type { LLMProvider } from './types.js';
import { ClaudeCLIProvider } from './claude-cli.js';

const providers = new Map<string, LLMProvider>();

export function registerProvider(provider: LLMProvider): void {
  providers.set(provider.id, provider);
  logger.debug({ providerId: provider.id }, 'Provider registered');
}

export function getProvider(id: string): LLMProvider | undefined {
  return providers.get(id);
}

export function getDefaultProvider(): LLMProvider {
  const provider = providers.get(config.DEFAULT_PROVIDER);
  if (!provider) {
    const first = providers.values().next().value;
    if (!first) throw new Error('No LLM providers registered');
    return first;
  }
  return provider;
}

export function listProviders(): LLMProvider[] {
  return Array.from(providers.values());
}

export async function initProviders(): Promise<void> {
  // CLI Providers
  const claudeCli = new ClaudeCLIProvider();
  registerProvider(claudeCli);

  // Lazy-load additional providers (Phase 5)
  try {
    const { GeminiCLIProvider } = await import('./gemini-cli.js');
    registerProvider(new GeminiCLIProvider());
  } catch { /* not yet implemented */ }

  try {
    const { CodexCLIProvider } = await import('./codex-cli.js');
    registerProvider(new CodexCLIProvider());
  } catch { /* not yet implemented */ }

  try {
    const { ClaudeAPIProvider } = await import('./claude-api.js');
    registerProvider(new ClaudeAPIProvider());
  } catch { /* not yet implemented */ }

  try {
    const { OpenAIAPIProvider } = await import('./openai-api.js');
    registerProvider(new OpenAIAPIProvider());
  } catch { /* not yet implemented */ }

  try {
    const { GeminiAPIProvider } = await import('./gemini-api.js');
    registerProvider(new GeminiAPIProvider());
  } catch { /* not yet implemented */ }

  // Log available providers
  const available: string[] = [];
  for (const p of providers.values()) {
    if (await p.isAvailable()) {
      available.push(p.id);
    }
  }
  logger.info({ providers: available }, 'Available LLM providers');
}
