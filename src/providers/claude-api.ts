import { config } from '../config.js';
import { logger } from '../logger.js';
import type { LLMProvider, LLMProviderHandle, LLMResult } from './types.js';

export class ClaudeAPIProvider implements LLMProvider {
  readonly id = 'claude-api';
  readonly name = 'Claude (API)';
  readonly mode = 'api' as const;

  supportsResume(): boolean {
    return false;
  }

  async isAvailable(): Promise<boolean> {
    return Boolean(config.ANTHROPIC_API_KEY);
  }

  run(prompt: string, _workingDir: string, _sessionId: string | null, systemPrompt: string): LLMProviderHandle {
    logger.debug({ provider: this.id }, 'Claude API request');

    const promise = (async (): Promise<LLMResult> => {
      const response = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': config.ANTHROPIC_API_KEY,
          'anthropic-version': '2023-06-01',
        },
        body: JSON.stringify({
          model: config.CLAUDE_MODEL,
          max_tokens: 8192,
          system: systemPrompt || undefined,
          messages: [{ role: 'user', content: prompt }],
        }),
        signal: AbortSignal.timeout(config.RESPONSE_TIMEOUT_MS),
      });

      if (!response.ok) {
        const errorText = await response.text();
        logger.error({ provider: 'claude-api', status: response.status, error: errorText.slice(0, 500) }, 'Provider API error');
        return {
          text: `Provider error (${response.status}). Check server logs for details.`,
          sessionId: null,
          costUsd: null,
          isError: true,
        };
      }

      const data = await response.json() as {
        content: Array<{ type: string; text: string }>;
        usage?: { input_tokens: number; output_tokens: number };
      };

      const text = data.content
        .filter((c) => c.type === 'text')
        .map((c) => c.text)
        .join('');

      // Estimate cost (Claude Sonnet 4.5: $3/1M input, $15/1M output)
      let costUsd: number | null = null;
      if (data.usage) {
        costUsd = (data.usage.input_tokens * 3 + data.usage.output_tokens * 15) / 1_000_000;
      }

      return { text, sessionId: null, costUsd, isError: false };
    })();

    return { promise, process: null };
  }
}
