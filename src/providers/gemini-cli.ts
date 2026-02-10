import { spawn } from 'node:child_process';
import { config } from '../config.js';
import { logger } from '../logger.js';
import type { LLMProvider, LLMProviderHandle, LLMResult } from './types.js';

export class GeminiCLIProvider implements LLMProvider {
  readonly id = 'gemini-cli';
  readonly name = 'Gemini (CLI)';
  readonly mode = 'cli' as const;

  supportsResume(): boolean {
    return false;
  }

  async isAvailable(): Promise<boolean> {
    try {
      const child = spawn(config.GEMINI_BIN, ['--version'], { timeout: 5000 });
      return new Promise((resolve) => {
        child.on('close', (code) => resolve(code === 0));
        child.on('error', () => resolve(false));
      });
    } catch {
      return false;
    }
  }

  run(prompt: string, workingDir: string, _sessionId: string | null, systemPrompt: string): LLMProviderHandle {
    const fullPrompt = systemPrompt ? `${systemPrompt}\n\n---\n\n${prompt}` : prompt;
    const child = spawn(config.GEMINI_BIN, ['-p', fullPrompt], {
      cwd: workingDir,
      env: { ...process.env },
      stdio: ['ignore', 'pipe', 'pipe'],
    });

    logger.debug({ provider: this.id, cwd: workingDir }, 'Gemini CLI spawned');

    const promise = new Promise<LLMResult>((resolve, reject) => {
      let stdout = '';
      let stderr = '';

      child.stdout.on('data', (chunk: Buffer) => { stdout += chunk.toString(); });
      child.stderr.on('data', (chunk: Buffer) => { stderr += chunk.toString(); });

      const timer = setTimeout(() => {
        child.kill('SIGTERM');
        reject(new Error(`Timeout: Gemini CLI did not respond within ${config.RESPONSE_TIMEOUT_MS}ms`));
      }, config.RESPONSE_TIMEOUT_MS);

      child.on('close', (code) => {
        clearTimeout(timer);
        resolve({
          text: stdout.trim() || stderr.trim() || `Gemini CLI exited with code ${code}`,
          sessionId: null,
          costUsd: null,
          isError: code !== 0,
        });
      });

      child.on('error', (err) => {
        clearTimeout(timer);
        reject(err);
      });
    });

    return { promise, process: child };
  }
}
