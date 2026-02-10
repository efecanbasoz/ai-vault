import type { ChildProcess } from 'node:child_process';

export interface LLMResult {
  text: string;
  sessionId: string | null;
  costUsd: number | null;
  isError: boolean;
}

export interface LLMProviderHandle {
  promise: Promise<LLMResult>;
  process: ChildProcess | null;
}

export interface LLMProvider {
  readonly id: string;
  readonly name: string;
  readonly mode: 'cli' | 'api';
  run(prompt: string, workingDir: string, sessionId: string | null, systemPrompt: string): LLMProviderHandle;
  supportsResume(): boolean;
  isAvailable(): Promise<boolean>;
}
