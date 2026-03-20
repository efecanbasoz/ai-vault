import { config } from '../config.js';
import { logger } from '../logger.js';
import type { LLMProvider, LLMProviderHandle, LLMResult } from './types.js';

export class GeminiAPIProvider implements LLMProvider {
  readonly id = 'gemini-api';
  readonly name = 'Gemini (API)';
  readonly mode = 'api' as const;

  supportsResume(): boolean {
    return false;
  }

  async isAvailable(): Promise<boolean> {
    return Boolean(config.GOOGLE_API_KEY);
  }

  run(prompt: string, _workingDir: string, _sessionId: string | null, systemPrompt: string): LLMProviderHandle {
    logger.debug({ provider: this.id }, 'Gemini API request');

    const promise = (async (): Promise<LLMResult> => {
      const model = config.GEMINI_MODEL;
      const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`;

      const contents: Array<{ role: string; parts: Array<{ text: string }> }> = [];
      contents.push({ role: 'user', parts: [{ text: prompt }] });

      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-goog-api-key': config.GOOGLE_API_KEY,
        },
        body: JSON.stringify({
          contents,
          systemInstruction: systemPrompt ? { parts: [{ text: systemPrompt }] } : undefined,
          generationConfig: { maxOutputTokens: 8192 },
        }),
        signal: AbortSignal.timeout(config.RESPONSE_TIMEOUT_MS),
      });

      if (!response.ok) {
        const errorText = await response.text();
        logger.error({ provider: 'gemini-api', status: response.status, error: errorText.slice(0, 500) }, 'Provider API error');
        return {
          text: `Provider error (${response.status}). Check server logs for details.`,
          sessionId: null,
          costUsd: null,
          isError: true,
        };
      }

      const data = await response.json() as {
        candidates: Array<{ content: { parts: Array<{ text: string }> } }>;
        usageMetadata?: { promptTokenCount: number; candidatesTokenCount: number };
      };

      const text = data.candidates?.[0]?.content?.parts
        ?.map((p) => p.text)
        ?.join('') ?? '';

      return { text, sessionId: null, costUsd: null, isError: false };
    })();

    return { promise, process: null };
  }
}
