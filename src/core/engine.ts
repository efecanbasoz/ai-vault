import { config } from '../config.js';
import { logger } from '../logger.js';
import type { Prompt, PromptResult } from '../types.js';
import { getProvider, getDefaultProvider } from '../providers/registry.js';
import { getSession } from './session.js';

export async function execute(prompt: Prompt): Promise<PromptResult> {
  const startTime = Date.now();
  const session = getSession(prompt.userId, config.DEFAULT_PROVIDER);

  // Resolve provider
  const providerId = prompt.providerId ?? session.providerId;
  const provider = getProvider(providerId) ?? getDefaultProvider();

  // Guard: already busy
  if (session.busy) {
    return {
      text: 'A request is already in progress. Use /stop to cancel it first.',
      sessionId: session.sessionId,
      providerId: provider.id,
      costUsd: null,
      isError: true,
      durationMs: Date.now() - startTime,
    };
  }

  session.busy = true;

  try {
    // Build system prompt
    let systemPrompt = '';
    try {
      const { buildSystemPrompt } = await import('../vault/system-prompt.js');
      systemPrompt = await buildSystemPrompt(prompt.userId);
    } catch {
      // Vault not yet initialized — no system prompt
    }

    // Determine working directory
    const workingDir = process.cwd();

    // For API providers, prepend conversation history
    let finalPrompt = prompt.message;
    if (provider.mode === 'api' && session.messageHistory.length > 0) {
      // API providers receive the full history via their own mechanism
    }

    const handle = provider.run(finalPrompt, workingDir, prompt.sessionId ?? session.sessionId, systemPrompt);
    session.currentProcess = handle.process;

    const result = await handle.promise;

    // Update session
    session.sessionId = result.sessionId ?? session.sessionId;
    session.currentProcess = null;
    session.busy = false;

    // Track message history for API providers
    session.messageHistory.push(
      { role: 'user', content: prompt.message },
      { role: 'assistant', content: result.text },
    );

    // Prevent unbounded memory growth
    const MAX_HISTORY = 200;
    if (session.messageHistory.length > MAX_HISTORY) {
      session.messageHistory = session.messageHistory.slice(-MAX_HISTORY);
    }

    const durationMs = Date.now() - startTime;
    logger.info(
      { userId: prompt.userId, provider: provider.id, durationMs, cost: result.costUsd },
      'Prompt completed',
    );

    return {
      text: result.text,
      sessionId: session.sessionId,
      providerId: provider.id,
      costUsd: result.costUsd,
      isError: result.isError,
      durationMs,
    };
  } catch (err) {
    session.currentProcess = null;
    session.busy = false;
    const durationMs = Date.now() - startTime;

    const errorMessage = err instanceof Error ? err.message : String(err);
    logger.error({ userId: prompt.userId, provider: provider.id, err: errorMessage }, 'Prompt failed');

    return {
      text: 'An error occurred while processing your request. Please try again.',
      sessionId: session.sessionId,
      providerId: provider.id,
      costUsd: null,
      isError: true,
      durationMs,
    };
  }
}
