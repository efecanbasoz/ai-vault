import { config } from '../config.js';
import { logger } from '../logger.js';
import type { LLMProvider, LLMProviderHandle, LLMResult } from './types.js';

export class OpenAIAPIProvider implements LLMProvider {
  readonly id = 'openai-api';
  readonly name = 'OpenAI (API)';
  readonly mode = 'api' as const;

  supportsResume(): boolean {
    return false;
  }

  async isAvailable(): Promise<boolean> {
    return Boolean(config.OPENAI_API_KEY);
  }

  run(prompt: string, _workingDir: string, _sessionId: string | null, systemPrompt: string): LLMProviderHandle {
    logger.debug({ provider: this.id }, 'OpenAI API request');

    const promise = (async (): Promise<LLMResult> => {
      const messages: Array<{ role: string; content: string }> = [];
      if (systemPrompt) {
        messages.push({ role: 'system', content: systemPrompt });
      }
      messages.push({ role: 'user', content: prompt });

      const response = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${config.OPENAI_API_KEY}`,
        },
        body: JSON.stringify({
          model: config.OPENAI_MODEL,
          messages,
          max_tokens: 8192,
        }),
        signal: AbortSignal.timeout(config.RESPONSE_TIMEOUT_MS),
      });

      if (!response.ok) {
        const errorText = await response.text();
        logger.error({ provider: 'openai-api', status: response.status, error: errorText.slice(0, 500) }, 'Provider API error');
        return {
          text: `Provider error (${response.status}). Check server logs for details.`,
          sessionId: null,
          costUsd: null,
          isError: true,
        };
      }

      const data = await response.json() as {
        choices: Array<{ message: { content: string } }>;
        usage?: { prompt_tokens: number; completion_tokens: number };
      };

      const text = data.choices[0]?.message?.content ?? '';

      // Estimate cost (GPT-4o: $2.50/1M input, $10/1M output)
      let costUsd: number | null = null;
      if (data.usage) {
        costUsd = (data.usage.prompt_tokens * 2.5 + data.usage.completion_tokens * 10) / 1_000_000;
      }

      return { text, sessionId: null, costUsd, isError: false };
    })();

    return { promise, process: null };
  }
}
