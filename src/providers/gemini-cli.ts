import { spawn } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { homedir } from 'node:os';
import { config } from '../config.js';
import { logger } from '../logger.js';
import type { LLMProvider, LLMProviderHandle, LLMResult } from './types.js';
import { createSafeCliEnv } from './safe-env.js';

function readGeminiCliKey(): string | undefined {
  try {
    const envFile = readFileSync(join(homedir(), '.gemini', '.env'), 'utf-8');
    const match = envFile.match(/^GEMINI_API_KEY=(.+)$/m);
    return match?.[1]?.trim();
  } catch {
    return undefined;
  }
}

export class GeminiCLIProvider implements LLMProvider {
  readonly id = 'gemini-cli';
  readonly name = 'Gemini (CLI)';
  readonly mode = 'cli' as const;
  private availabilityCheck: Promise<boolean> | null = null;

  supportsResume(): boolean {
    return false;
  }

  async isAvailable(): Promise<boolean> {
    if (!this.availabilityCheck) {
      this.availabilityCheck = new Promise((resolve) => {
        try {
          const child = spawn(config.GEMINI_BIN, ['--version'], { timeout: 5000 });
          child.on('close', (code) => resolve(code === 0));
          child.on('error', () => resolve(false));
        } catch {
          resolve(false);
        }
      });
    }

    return this.availabilityCheck;
  }

  run(prompt: string, workingDir: string, _sessionId: string | null, systemPrompt: string): LLMProviderHandle {
    const fullPrompt = systemPrompt ? `${systemPrompt}\n\n---\n\n${prompt}` : prompt;
    const args = config.GEMINI_MODEL ? ['-m', config.GEMINI_MODEL, '-p', fullPrompt] : ['-p', fullPrompt];
    const child = spawn(config.GEMINI_BIN, args, {
      cwd: workingDir,
      env: {
        ...createSafeCliEnv({
          exactKeys: ['GOOGLE_API_KEY'],
          prefixKeys: ['GEMINI_'],
        }),
        ...(!process.env.GEMINI_API_KEY && { GEMINI_API_KEY: readGeminiCliKey() }),
      },
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
