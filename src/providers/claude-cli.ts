import { spawn } from 'node:child_process';
import { config } from '../config.js';
import { logger } from '../logger.js';
import type { LLMProvider, LLMProviderHandle, LLMResult } from './types.js';

export class ClaudeCLIProvider implements LLMProvider {
  readonly id = 'claude-cli';
  readonly name = 'Claude Code (CLI)';
  readonly mode = 'cli' as const;

  supportsResume(): boolean {
    return true;
  }

  async isAvailable(): Promise<boolean> {
    try {
      const child = spawn(config.CLAUDE_BIN, ['--version'], { timeout: 5000 });
      return new Promise((resolve) => {
        child.on('close', (code) => resolve(code === 0));
        child.on('error', () => resolve(false));
      });
    } catch {
      return false;
    }
  }

  run(prompt: string, workingDir: string, sessionId: string | null, systemPrompt: string): LLMProviderHandle {
    const args = ['-p', prompt, '--output-format', 'json', '--dangerously-skip-permissions'];
    if (sessionId) {
      args.push('--resume', sessionId);
    }
    if (systemPrompt) {
      args.push('--system-prompt', systemPrompt);
    }

    const child = spawn(config.CLAUDE_BIN, args, {
      cwd: workingDir,
      env: { ...process.env },
      stdio: ['ignore', 'pipe', 'pipe'],
    });

    logger.debug({ provider: this.id, sessionId, cwd: workingDir }, 'Claude CLI spawned');

    const promise = new Promise<LLMResult>((resolve, reject) => {
      let stdout = '';
      let stderr = '';

      child.stdout.on('data', (chunk: Buffer) => {
        stdout += chunk.toString();
      });
      child.stderr.on('data', (chunk: Buffer) => {
        stderr += chunk.toString();
      });

      const timer = setTimeout(() => {
        child.kill('SIGTERM');
        reject(new Error(`Timeout: Claude CLI did not respond within ${config.RESPONSE_TIMEOUT_MS}ms`));
      }, config.RESPONSE_TIMEOUT_MS);

      child.on('close', (code) => {
        clearTimeout(timer);

        if (stderr) {
          logger.debug({ stderr: stderr.slice(0, 500) }, 'Claude CLI stderr');
        }

        try {
          const parsed = JSON.parse(stdout);
          resolve({
            text: parsed.result ?? stdout,
            sessionId: parsed.session_id ?? null,
            costUsd: parsed.cost_usd ?? null,
            isError: parsed.is_error ?? (code !== 0),
          });
        } catch {
          if (stdout.trim()) {
            resolve({
              text: stdout.trim(),
              sessionId: null,
              costUsd: null,
              isError: code !== 0,
            });
          } else {
            reject(new Error(stderr || `Claude CLI exited with code ${code}`));
          }
        }
      });

      child.on('error', (err) => {
        clearTimeout(timer);
        reject(err);
      });
    });

    return { promise, process: child };
  }
}
